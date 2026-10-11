# Initial Database Design

**Version:** 0.3  
**Status:** Aligned with `DECISIONS.md`  
**Database:** PostgreSQL with EF Core  

---

## 1. Identity and access

### `Users`
- `Id` (UUID, Primary Key)
- `DisplayName` (varchar 100)
- `Email` (varchar 256, Normalized, Unique index)
- Identity password hash & security stamp (managed by ASP.NET Core Identity)
- `AccountStatus` (enum: `Active`, `Suspended`, `Closed`)
- `CreatedAtUtc` (timestamp with time zone)
- `UpdatedAtUtc` (timestamp with time zone)
- `LastLoginAtUtc` (timestamp with time zone, nullable)

### `Roles` / User Role Assignments
- Standard ASP.NET Core Identity tables (`AspNetRoles`, `AspNetUserRoles`).
- Primary roles: `Buyer`, `Admin`.
- *Rule:* Public registration assigns `Buyer` only. `Admin` assignment is seed-only or restricted to explicit administrative migration.

### `AuditEvents`
- `Id` (UUID, Primary Key)
- `ActorUserId` (UUID, nullable for system actions)
- `Action` (varchar 100)
- `TargetType` (varchar 100)
- `TargetId` (varchar 100)
- `Reason` (text, nullable)
- `MetadataJson` (jsonb, minimal safe data; never store passwords or PII)
- `CorrelationId` (varchar 100)
- `CreatedAtUtc` (timestamp with time zone)
- *Constraint:* Append-only; no updates or hard deletions.

---

## 2. Seller verification & Store profile

### `SellerApplications`
- `Id` (UUID, Primary Key)
- `UserId` (UUID, Foreign Key to `Users.Id`)
- `Status` (enum: `Pending`, `MoreInformationRequired`, `Approved`, `Rejected`, `Suspended`)
- `SubmittedAtUtc` (timestamp with time zone)
- `ReviewedAtUtc` (timestamp with time zone, nullable)
- `ReviewedByUserId` (UUID, Foreign Key to `Users.Id`, nullable)
- `DecisionReason` (text, nullable)
- `CreatedAtUtc`, `UpdatedAtUtc`
- *Index:* Partial unique index on `UserId` where `Status = 'Pending'` (at most one pending application per user).

### `VerificationEvidence`
- `Id` (UUID, Primary Key)
- `SellerApplicationId` (UUID, Foreign Key to `SellerApplications.Id`, Cascade delete)
- `EvidenceType` (enum: `NationalIdFront`, `NationalIdBack`, `BusinessLicense`, `UtilityBill`)
- `PrivateStorageKey` (varchar 500)
- `FileSizeBytes` (bigint)
- `MimeType` (varchar 100)
- `Sha256Checksum` (varchar 64)
- `UploadedAtUtc` (timestamp with time zone)
- `ReviewStatus` (enum: `Pending`, `Verified`, `Rejected`)
- `RetentionUntilUtc` (timestamp with time zone, nullable)
- *Rule:* Private storage key only; never expose a public URL.

### `VerificationDecisionHistory`
- `Id` (UUID, Primary Key)
- `SellerApplicationId` (UUID, Foreign Key to `SellerApplications.Id`)
- `ActorUserId` (UUID, Foreign Key to `Users.Id`)
- `PreviousStatus` (varchar 50)
- `NewStatus` (varchar 50)
- `Reason` (text, nullable)
- `CreatedAtUtc` (timestamp with time zone)

### `SellerProfiles` (Dedicated Store Entity)
- `Id` (UUID, Primary Key)
- `SellerUserId` (UUID, Foreign Key to `Users.Id`, Unique)
- `StoreName` (varchar 100, Unique)
- `Slug` (varchar 100, Unique)
- `Bio` (varchar 500, nullable)
- `ContactPhone` (varchar 30)
- `CityOrTownship` (varchar 100)
- `LogoStorageKey` (varchar 500, nullable)
- `VerificationStatus` (enum: `Verified`, `PendingReverification`)
- `CreatedAtUtc`, `UpdatedAtUtc`
- *Rule:* Created upon seller application approval. If `StoreName` is modified, `VerificationStatus` shifts to `PendingReverification`.

---

## 3. Catalog

### `Categories`
- `Id` (UUID, Primary Key)
- `Name` (varchar 100)
- `Slug` (varchar 100, Unique)
- `ParentCategoryId` (UUID, Foreign Key to `Categories.Id`, nullable)
- `IsActive` (boolean, default true)

### `Products`
- `Id` (UUID, Primary Key)
- `SellerUserId` (UUID, Foreign Key to `Users.Id`)
- `SellerProfileId` (UUID, Foreign Key to `SellerProfiles.Id`)
- `CategoryId` (UUID, Foreign Key to `Categories.Id`)
- `Title` (varchar 200)
- `Description` (text)
- `PriceAmount` (decimal(18,2))
- `CurrencyCode` (varchar 3, default 'MMK')
- `Condition` (enum: `New`, `LikeNew`, `Used`)
- `Status` (enum: `Draft`, `Published`, `Archived`)
- `CreatedAtUtc`, `UpdatedAtUtc`
- *Concurrency:* `xmin` (PostgreSQL system column) or `RowVersion` for optimistic concurrency.

### `ProductImages`
- `Id` (UUID, Primary Key)
- `ProductId` (UUID, Foreign Key to `Products.Id`, Cascade delete)
- `StorageKey` (varchar 500)
- `SortOrder` (integer, default 0)
- `CreatedAtUtc` (timestamp with time zone)

---

## 4. Orders and reviews (Non-custodial)

### `Orders`
- `Id` (UUID, Primary Key)
- `BuyerUserId` (UUID, Foreign Key to `Users.Id`)
- `SellerUserId` (UUID, Foreign Key to `Users.Id`)
- `SellerProfileId` (UUID, Foreign Key to `SellerProfiles.Id`)
- `Status` (enum: `Placed`, `Accepted`, `Shipped`, `Completed`, `Cancelled`, `Disputed`)
- `CurrencyCode` (varchar 3, default 'MMK')
- `SubtotalAmount` (decimal(18,2))
- `BuyerContactPhone` (varchar 30)
- `DeliveryAddressSnapshot` (text)
- `DeliveryCityOrTownshipSnapshot` (varchar 100)
- `DeliveryNotes` (text, nullable)
- `ShippedAtUtc` (timestamp with time zone, nullable)
- `CompletedAtUtc` (timestamp with time zone, nullable)
- `CompletedByUserId` (UUID, Foreign Key to `Users.Id`, nullable)
- `CreatedAtUtc`, `UpdatedAtUtc`

### `OrderItems`
- `Id` (UUID, Primary Key)
- `OrderId` (UUID, Foreign Key to `Orders.Id`, Cascade delete)
- `ProductId` (UUID, Foreign Key to `Products.Id`, Set Null on delete)
- `ProductTitleSnapshot` (varchar 200)
- `UnitPriceSnapshot` (decimal(18,2))
- `Quantity` (integer, default 1)
- `ConditionSnapshot` (varchar 50)

### `OrderStatusHistory`
- `Id` (UUID, Primary Key)
- `OrderId` (UUID, Foreign Key to `Orders.Id`, Cascade delete)
- `ActorUserId` (UUID, Foreign Key to `Users.Id`)
- `PreviousStatus` (varchar 50)
- `NewStatus` (varchar 50)
- `Reason` (text, nullable)
- `CreatedAtUtc` (timestamp with time zone)

### `Reviews`
- `Id` (UUID, Primary Key)
- `OrderId` (UUID, Foreign Key to `Orders.Id`, Unique)
- `ReviewerUserId` (UUID, Foreign Key to `Users.Id`)
- `SellerUserId` (UUID, Foreign Key to `Users.Id`)
- `Rating` (integer, 1 to 5)
- `Comment` (text)
- `ModerationStatus` (enum: `Published`, `Hidden`, `Flagged`)
- `CreatedAtUtc` (timestamp with time zone)
- *Index:* Unique constraint on `(OrderId, ReviewerUserId)`. Exactly one review per order.

---

## 5. Complaints and dispute adjudication

### `Complaints`
- `Id` (UUID, Primary Key)
- `ReporterUserId` (UUID, Foreign Key to `Users.Id`)
- `OrderId` (UUID, Foreign Key to `Orders.Id`, nullable)
- `SellerUserId` (UUID, Foreign Key to `Users.Id`, nullable)
- `Status` (enum: `Submitted`, `UnderReview`, `Resolved`, `Dismissed`)
- `Description` (text)
- `AssignedToUserId` (UUID, Foreign Key to `Users.Id`, nullable)
- `ResolutionCode` (enum: `RefundAgreed`, `GoodsDeliveredConfirmed`, `WarningIssued`, `Unfounded`, nullable)
- `ResolutionSummary` (text, nullable)
- `CreatedAtUtc`, `UpdatedAtUtc`, `ResolvedAtUtc`

### `ComplaintEvidence`
- `Id` (UUID, Primary Key)
- `ComplaintId` (UUID, Foreign Key to `Complaints.Id`, Cascade delete)
- `PrivateStorageKey` (varchar 500)
- `EvidenceType` (varchar 50)
- `UploadedAtUtc` (timestamp with time zone)

---

## 6. Subscriptions (Admin-managed mock entitlements)

### `SubscriptionPlans`
- `Id` (UUID, Primary Key)
- `Name` (varchar 50, e.g., 'Free', 'Standard', 'Premium')
- `MaxActiveListings` (integer, e.g., 10, 30, 100)
- `PriceAmount` (decimal(18,2))
- `CurrencyCode` (varchar 3, default 'MMK')
- `BillingPeriod` (varchar 20, default 'Monthly')
- `IsActive` (boolean, default true)

### `SellerSubscriptions`
- `Id` (UUID, Primary Key)
- `SellerUserId` (UUID, Foreign Key to `Users.Id`)
- `SubscriptionPlanId` (UUID, Foreign Key to `SubscriptionPlans.Id`)
- `Status` (enum: `Active`, `Expired`, `Cancelled`)
- `StartsAtUtc` (timestamp with time zone)
- `ExpiresAtUtc` (timestamp with time zone)
- `AssignedByUserId` (UUID, Foreign Key to `Users.Id`, nullable)
- `CreatedAtUtc`, `UpdatedAtUtc`
- *Rule:* Managed administratively for Phase 1. No payment gateway references.

---

## 7. Requires Team Approval

1. **Evidence Deletion Trigger Implementation:** Confirming automated background cleanup vs manual admin trigger for files past `RetentionUntilUtc`.
2. **Product Deletion Policy:** Setting `OrderItems.ProductId` to NULL upon product deletion vs soft-deleting products.
3. **Store Name Slug Collision Policy:** Auto-generating numerical suffixes (e.g., `store-name-2`) or returning 409 Conflict.

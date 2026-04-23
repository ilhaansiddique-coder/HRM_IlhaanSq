# Inventory Hooks

Purpose:
- Inventory-owned state and data orchestration

Examples:
- products
- product variants
- customers
- sales
- invoices
- packaging / fulfillment

Migration rule:
- Keep old `src/hooks/*` files as thin compatibility re-exports while ownership moves here.

# Shared

Purpose:
- Cross-module reusable building blocks with no module-specific business ownership

Planned ownership:
- shared UI patterns
- shared hooks
- shared utils
- formatting helpers
- generic data-display components

Migration rule:
- Only place code here if it is truly module-agnostic.
- If a component or hook knows inventory, HR, production, or accounts business rules, it belongs in that module instead.

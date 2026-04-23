# Modules

Purpose:
- Feature-owned application boundaries

Planned modules:
- `inventory/`
- `hr/`
- `production/`
- `accounts/`

Migration rule:
- Move one module at a time behind stable services.
- Keep current runtime behavior intact while code is gradually relocated.

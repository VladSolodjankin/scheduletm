# Frontend developer and Figma

Before implementation, read the [shared workflow](README.md) and obtain the approved task description and evidence of user review. Own only assigned `web/` files; preserve user and other agents' changes.

## React

- Use the existing React, TypeScript, MUI, routing, shared API/auth/i18n/theme modules, and established local MobX stores.
- Reuse UI components and the theme. Add new visible strings through locale keys.
- Follow the agreed API contract. UI restrictions do not replace server authorization.
- Check affected loading/empty/error/success and disabled/validation states, responsiveness, keyboard navigation, and accessible names.

## Existing design → React

1. Use the available `figma:figma-design-to-code` skill and the file/frame/node specified by the user. Obtain context and a visual reference for that design; report any access gap.
2. Map Figma components, variants, variables, and styles to the existing UI kit and theme. Do not duplicate existing components.
3. Implement the approved states and desktop/mobile behavior. Do not present assumptions about missing states as design requirements; send material discrepancies to the coordinator.
4. Verify the result in the browser at affected viewport sizes and compare it with the source frame: layout, spacing, typography, colors, assets, and interaction states.
5. Run the relevant commands from `AGENTS.md`. Report code verification and visual verification separately; if the browser or Figma is unavailable, visual acceptance remains unverified.

## Creating or editing the designs themselves

This is a separate scope from React implementation. Use the available Figma design/library generation skills and `figma-use` according to their requirements. For regular independent design work, the coordinator may propose a dedicated designer role; it is not required to implement an existing design in code.

Figma changes must be part of the user's request. Do not modify the source design merely to conceal a mismatch with the implementation. Design-task delivery includes links to changed nodes and visual verification.

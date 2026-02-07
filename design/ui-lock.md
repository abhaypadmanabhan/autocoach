# AutoCoach UI Lock - Sentinel Mascot Placement Rules

## Overview
The Sentinel mascot is a sentient brand element that appears throughout the app to provide emotional feedback and brand personality.

## Import Pattern
```tsx
import { SentinelMascot } from "@/components/brand/SentinelMascot";
```

## Placement Rules

### 1. Dashboard / Document Dashboard
- **Location**: Header area, top-right or inline with title
- **Variant**: `neutral`
- **Size**: `w-10 h-10` (small, subtle)
- **Behavior**: Passive bobbing animation, eye tracking

### 2. Loading States (Full-screen overlay)
- **Location**: Center of screen, above tips
- **Variant**: `thinking`
- **Size**: `w-16 h-16` (medium-large, prominent)
- **Behavior**: Active thinking animation with rotating tips below
- **Z-index**: Same as overlay content (z-50+)

### 3. Quiz Session Page
- **Location**: Near question header, right side
- **Variants**:
  - Default/choosing: `thinking`
  - Correct answer: `success`
  - Wrong answer: `wrong`
  - Time's up: `timeout`
- **Size**: `w-12 h-12` (medium)
- **Behavior**: Reacts to user input and feedback state

### 4. Results Page
- **Location**: Score card area or header
- **Variants** (based on score):
  - Score >= 80%: `success`
  - Score 40-79%: `neutral`
  - Score < 40%: `wrong` (with friendly copy)
- **Size**: `w-14 h-14` (medium)
- **Copy**: One short line next to mascot, minimal and friendly

## Standard Sizes
- `sm`: w-16 h-16 (subtle)
- `md`: w-24 h-24 (standard)
- `lg`: w-32 h-32 (hero/loading)

## Default Placements by Mode
- **dashboard header**: md (w-24 h-24)
- **loading overlay**: lg (w-32 h-32)
- **quiz coach strip**: md (w-24 h-24)
- **results header**: md (w-24 h-24)

## Copy Rule
- Maximum 1 short line of guidance text
- Calm, premium tone
- Examples: "Ready when you are.", "Nice. Locking that in."

## Theming
- Head fill uses muted `var(--brand-secondary)` at 85% opacity
- Eyes/accents use `var(--brand-primary)`
- No custom colors - always use theme variables

## Animation Rules
- Never disable built-in animations (bobbing, blinking, eye-tracking)
- Variant transitions handled internally by component
- Timeout jitter only on `timeout` variant

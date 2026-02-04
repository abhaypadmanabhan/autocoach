# AutoCoach Design System Implementation

## Overview
This document describes the comprehensive design system implemented for AutoCoach based on the video design extraction and UI blueprint specification.

## Color Palette

### Brand Colors
- **Primary**: `#cd776a` (Dusty Rose)
- **Secondary**: `#c18c5d` (Toasted Almond)

### Surface Colors (Dark Mode First)
- **Surface Dark**: `#34344a` (Space Indigo - main background)
- **Surface Darker**: `#2a2a3e` (Bottom bars, elevated elements)
- **Surface Card**: `#3a3a52` (Cards, elevated surfaces)
- **Surface Border**: `#495867` (Blue Slate - borders, dividers)

### Semantic Colors
- **Success**: `#22c55e`
- **Error**: `#ef4444`
- **Warning**: `#eab308`

### Text Colors
- **Text Primary**: `#f2f5de` (Light cream)
- **Text Secondary**: `rgba(242, 245, 222, 0.7)`
- **Text Muted**: `rgba(242, 245, 222, 0.5)`

## Typography System

### Font Families
- **Serif (Headlines)**: Playfair Display, Cormorant Garamond, Georgia
- **Sans (UI)**: Inter, DM Sans, system-ui

### Type Scale
- **Hero/Brand**: 64-96px, weight 400-500, tight letter-spacing (-0.02em)
- **H1**: 48px, weight 500
- **H2**: 32px, weight 500
- **Body**: 16px, weight 400, line-height 1.6
- **Small/Labels**: 14px, weight 500, uppercase tracking (0.05em)
- **Micro**: 12px, weight 400
- **Numerals**: 120px+, weight 300 (decorative)

## Motion System (Framer Motion)

### Transition Presets
Located in `src/lib/motions.ts`:
- **Expo**: 0.6s, ease [0.22, 1, 0.36, 1] - Page transitions
- **Smooth**: 0.5s, ease [0.33, 1, 0.68, 1] - Slide reveals
- **Snappy**: 0.3s, ease [0.4, 0, 0.2, 1] - Button interactions
- **Spring**: type: "spring", stiffness: 300, damping: 30

### Animation Variants
- `pageVariants`: Enter/center/exit states for page transitions
- `diamondVariants`: Rotation states for diamond motif (idle/hover/active/tap)
- `staggerContainer`: Parent container for staggered children
- `slideUpItem`: Y-axis slide with fade
- `feedbackPanelVariants`: Bottom sheet animations
- `scoreCircleVariants`: SVG stroke draw animation

## Component Inventory

### UI Components (`src/components/ui/`)

#### DiamondButton
- Rotating diamond-shaped button (45deg rotation)
- Hover: rotates to 90deg, scales 1.1
- Variants: primary, secondary, outline
- Sizes: sm, md, lg

#### DiamondSpinner
- Loading spinner with continuous 360deg rotation
- Uses diamond motif with 2s linear infinite animation

#### DiamondMarker
- Timeline step indicator
- States: idle, active (45deg), completed (with checkmark)

#### OptionPill
- Pill-shaped selection button
- States: default, selected (filled), hover
- Supports multi-select with checkmark
- Can include icons

#### DifficultyCard
- Card for difficulty selection (Easy/Medium/Hard)
- Includes emoji icon, label, description
- Selected state: scale 1.05, border glow

#### StatusBadge
- Displays document status (pending/processing/ready/error)
- Pulse animation for processing states
- Color-coded by status

#### ProgressBar
- Horizontal progress indicator
- Animates width with smooth transition
- Optional percentage display

#### ProgressDots
- Three-dot loading indicator
- Staggered bounce animation

### Layout Components (`src/components/layout/`)

#### AppShell
- Global app container with navigation
- Features:
  - Sticky header with glass effect
  - Back button support
  - User avatar and settings
  - Decorative top circle
  - Optional bottom progress bar

#### PageContainer
- Max-width container with responsive padding
- Sizes: sm (600px), md (800px), lg (1000px), xl (1200px), full

#### Section
- Vertical spacing utility
- Spacing options: sm, md, lg

### Quiz Components (`src/components/quiz/`)

#### SetupStepper
- Vertical timeline with diamond markers
- Circular progress indicator with step number (.01, .02, etc.)
- Clickable step navigation
- Animated transitions between steps

#### StepContent
- Content wrapper for setup steps
- Decorative step number display
- Question text with serif typography

#### QuestionCard
- Displays question with options
- Supports types: MCQ, True/False, Free Text
- States: idle, selected, correct, wrong
- Decorative step number (.01 format)

#### FreeTextInput
- Auto-resizing textarea
- Character counter
- Dark background with focus states

#### TimerBar
- Horizontal countdown bar
- Color transitions: brand → yellow → red
- Warning pulse at 10s remaining

#### TimerCircle
- Circular countdown display
- SVG stroke animation
- Shows mm:ss format

#### FeedbackPanel
- Bottom sheet feedback after answer
- Staggered animation for content
- Correct/wrong color coding
- Shows explanation and correct answer

### Results Components (`src/components/results/`)

#### ScoreCircle
- Large circular score display
- Animated stroke draw (1.2s)
- Score counts up from 0
- Color-coded by percentage
- Background glow effect

#### StatSatellite
- Small stat card with icon
- Spring animation on mount
- Used for time, accuracy, difficulty

#### ScoreBreakdown
- Grid of stats (correct/incorrect/total)
- Staggered entrance animation
- Color-coded values

#### ReviewRow
- Expandable question review item
- Accordion animation for details
- Shows user answer vs correct answer
- Includes explanation

#### ReviewList
- Container for review rows
- Alternating border styling

## Page Implementations

### Dashboard (`/dashboard`)
- Hero greeting with "Study New" CTA
- Stats grid (documents, ready, processing)
- Document cards with status badges
- Empty state with decorative shapes
- Continue learning section

### Upload (`/upload`)
- Large drop zone with drag-over feedback
- Diamond spinner during processing
- Progress dots animation
- Tips grid at bottom
- File type validation (PDF, PPTX)

### Config/Setup (`/config`)
- 4-step wizard (Questions → Difficulty → Types → Timer)
- Left sidebar with stepper
- Right content area with step transitions
- Circular progress indicator
- Diamond button navigation

### Session (`/session`)
- Progress header with timer
- Question card with options
- Free text input support
- Feedback panel after submit
- Time's up overlay with shake animation

### Results (`/results`)
- Large score circle with animation
- Score breakdown grid
- Question review list (expandable)
- Action buttons (Dashboard, Try Again, Review)

## Animation Checklist (Implemented)

- [x] Page transitions use AnimatePresence with slide+fade
- [x] All buttons have whileHover and whileTap states
- [x] Loading states use rotating diamond or pulsing dots
- [x] Form submissions show loading state on button
- [x] Success states animate with scale+opacity
- [x] Lists stagger children on mount
- [x] Numbers that change animate with blur-to-clear effect
- [x] Scroll areas use smooth scrolling
- [x] Diamond motif used for primary CTAs
- [x] Feedback timing: 300ms+ transitions for user actions

## Accessibility

- Reduced motion support via `prefers-reduced-motion` media query
- Focus rings with brand-primary color
- Minimum contrast ratio 4.5:1
- Keyboard navigation support
- Screen reader friendly markup

## File Structure

```
frontend/src/
├── app/
│   ├── dashboard/page.tsx
│   ├── upload/page.tsx
│   ├── config/page.tsx
│   ├── session/page.tsx
│   └── results/page.tsx
├── components/
│   ├── layout/
│   │   └── AppShell.tsx
│   ├── quiz/
│   │   ├── SetupStepper.tsx
│   │   ├── QuestionCard.tsx
│   │   ├── TimerBar.tsx
│   │   └── FeedbackPanel.tsx
│   ├── results/
│   │   ├── ScoreCircle.tsx
│   │   └── ReviewRow.tsx
│   └── ui/
│       ├── DiamondButton.tsx
│       ├── OptionPill.tsx
│       └── StatusBadge.tsx
├── lib/
│   └── motions.ts
└── app/globals.css
```

## Usage Examples

### Using Motion Variants
```tsx
import { staggerContainer, slideUpItem } from "@/lib/motions";

<motion.div variants={staggerContainer} initial="hidden" animate="show">
  <motion.div variants={slideUpItem}>Content 1</motion.div>
  <motion.div variants={slideUpItem}>Content 2</motion.div>
</motion.div>
```

### Using Components
```tsx
import { OptionPill } from "@/components/ui/OptionPill";
import { DiamondButton } from "@/components/ui/DiamondButton";

<OptionPill
  label="10 Questions"
  selected={selected}
  onClick={() => setSelected(true)}
/>

<DiamondButton onClick={handleNext}>
  <ArrowRight />
</DiamondButton>
```

### Using AppShell
```tsx
import { AppShell, PageContainer } from "@/components/layout/AppShell";

<AppShell showBack title="Upload Document">
  <PageContainer size="md">
    {/* Page content */}
  </PageContainer>
</AppShell>
```

## Dependencies

- `framer-motion`: Animation library
- `lucide-react`: Icon library
- `tailwindcss`: Utility CSS framework

## Notes

- All animations respect user preference for reduced motion
- Dark mode is the default theme
- All colors use CSS custom properties for easy theming
- Component props are fully typed with TypeScript

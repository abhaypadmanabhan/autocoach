# AutoCoach NDEF (No Duplicate Effort Framework)

## Sentinel Mascot Component

### MUST USE
- **Import**: `import { SentinelMascot } from "@/components/brand/SentinelMascot";`
- **Location**: `@/components/brand/SentinelMascot.tsx`

### NO NEW MASCOT COMPONENTS
Unless explicitly requested, do NOT create:
- Alternative mascot designs
- Duplicate SVG implementations
- Custom animated characters
- One-off mascot variations

### Reuse Policy
The SentinelMascot component handles:
- All 5 emotional variants (`neutral`, `thinking`, `wrong`, `success`, `timeout`)
- All animations (bobbing, blinking, eye-tracking, transitions)
- All styling (theme variables, sizing)

### Props Interface
```tsx
interface SentinelMascotProps {
  variant?: 'neutral' | 'thinking' | 'wrong' | 'success' | 'timeout';
  className?: string; // For sizing (w-10 h-10, etc.)
}
```

### When Adding Mascot to New Pages
1. Import the component
2. Set appropriate variant based on UI state
3. Use standard sizes from ui-lock.md
4. Let component handle all animations internally

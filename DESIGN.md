# DESIGN.md

# Tecnogafas PWA — Design System & UX Refactor Guide

## Vision

Refactor the entire React + Vite PWA into a modern, premium, mobile-first SaaS experience inspired by:

- Linear
- Vercel
- Raycast
- Notion
- Stripe
- iOS 18
- Discord
- Slack

The application must feel:

- Native
- Fast
- Minimal
- Premium
- Fluid
- Touch-friendly
- Modern
- Accessible
- Consistent

Avoid any UI/UX patterns that resemble:

- Bootstrap dashboards
- Legacy admin panels
- Old Material UI aesthetics
- Generic templates
- Overcrowded interfaces

---

# Core Stack

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS v4
- DaisyUI
- Radix UI
- Radix Colors
- Framer Motion
- Lucide React

---

# Design System

## Colors

Use Radix Colors as the primary design token system.

### Requirements

- WCAG AA/AAA contrast
- Full dark mode support
- Semantic color usage
- Soft neutral palettes
- Consistent grayscale hierarchy
- Avoid pure black (#000000)
- Avoid harsh contrasts

### Recommended Radix palettes

#### Neutral

- slate
- gray
- mauve

#### Primary

- blue
- indigo
- cyan

#### Success

- jade
- green

#### Error

- crimson
- red

#### Warning

- amber
- orange

---

# DaisyUI Theme Architecture

Create two custom themes:

- tecnogafas-dark
- tecnogafas-light

Inspired by:

- Linear dark mode
- Vercel dashboard
- Raycast overlays
- iOS layered UI

The themes must use CSS variables mapped to Radix Colors.

Example:

```css
--background
--foreground
--primary
--secondary
--accent
--muted
--border
--card
--destructive
```

---

# Layout System

## Current Architecture

The application currently uses:

- Top toolbar
- Expandable sidebar menu

The refactor must modernize the entire navigation system while preserving current functionality.

---

# Top Toolbar

## Goals

The toolbar must feel modern, compact, premium, and fluid.

### Required Features

- Sticky positioning
- Backdrop blur
- Semi-transparent background
- Soft bottom border
- Dynamic shadow on scroll
- Mobile-first layout
- iOS safe-area support
- Responsive spacing
- Smooth transitions

---

# Toolbar Structure

## Left Section

- Modern hamburger button
- Minimal logo
- Optional breadcrumb

## Center Section

- Expandable search bar
- Keyboard shortcut support
- Responsive behavior
- Smooth animations

## Right Section

- Notifications
- Quick actions
- Profile avatar
- Online status
- Theme toggle

---

# Sidebar Navigation

The sidebar must behave like a modern SaaS navigation system.

Inspired by:

- Linear
- Discord
- Slack
- Vercel

---

# Sidebar UX

## Required Features

- Collapsible sidebar
- Floating mobile behavior
- Blur overlay
- Swipe gestures on mobile
- GPU accelerated transitions
- Adaptive width
- Persistent collapsed state
- Auto-close on mobile navigation
- Nested menu support

---

# Sidebar Visual Design

Apply:

- Radix color tokens
- DaisyUI themes
- Lucide icons
- Premium spacing
- Soft shadows
- Elegant hover states
- Clear active states
- Smooth animations

Avoid:

- Rigid Bootstrap-like sidebars
- Sharp edges
- Heavy borders
- Visual clutter

---

# Mobile UX

## Priority

The entire application must be mobile-first.

### Requirements

- Large touch targets
- Smooth scrolling
- Gesture support
- Bottom-safe layouts
- Native-like navigation
- Fast interactions
- Optimized keyboard behavior
- Responsive overlays

---

# Dropdowns & Overlays

All dropdowns and overlays must use Radix primitives.

### Use

- Radix DropdownMenu
- Radix Dialog
- Radix Tooltip
- Radix Popover
- Radix Sheet

### Requirements

- Keyboard navigation
- Focus trap
- Accessibility compliance
- Smooth motion
- Blur overlays
- Layered depth

---

# Cards

Refactor all cards.

### Requirements

- Softer borders
- Better spacing
- Hover states
- Skeleton loaders
- Responsive behavior
- Smooth transitions
- Improved typography
- Consistent hierarchy

---

# Forms & Inputs

Modernize all forms.

### Requirements

- Floating labels
- Accessible validation states
- Better mobile UX
- Improved focus states
- Touch-friendly controls
- Cleaner spacing
- Optimized keyboard behavior

---

# Notification System

Refactor notifications into a modern chat-like experience.

Inspired by:

- Discord
- Telegram
- Slack

### Features

- Reactions
- Read states
- Smart grouping
- Modern timestamps
- Avatars
- Animated interactions
- Smooth scrolling
- Optimistic updates

---

# Loading Experience

Replace old loading patterns.

### Use

- Skeleton loaders
- Shimmer effects
- Optimistic UI
- Lazy loading
- Suspense boundaries

### Avoid

- Blocking spinners
- Layout shifts
- Flashing loaders

---

# Typography

Typography must feel modern and premium.

### Requirements

- Better hierarchy
- Improved readability
- Responsive scaling
- Reduced visual noise
- Balanced spacing
- Consistent font weights

---

# Motion System

Use Framer Motion.

### Apply To

- Route transitions
- Hover interactions
- Sidebar transitions
- Dropdowns
- Modals
- Notifications
- Lists
- Cards

### Motion Principles

- Fast
- Subtle
- Premium
- GPU accelerated
- Never excessive

---

# Performance Optimization

## Requirements

- Reduce unnecessary re-renders
- Lazy-load routes
- Component splitting
- Virtualization when needed
- Memoization
- GPU accelerated animations
- Optimized images
- Better caching

### Remove

- Legacy CSS
- Heavy libraries
- Duplicate layouts
- Unused components

---

# Accessibility

## Must Support

- Keyboard navigation
- Focus visibility
- Screen readers
- ARIA compliance
- Reduced motion
- WCAG AA/AAA contrast

---

# PWA Experience

Improve the entire PWA feel.

### Requirements

- Native-like transitions
- Elegant offline states
- Smooth install prompts
- Better splash screens
- Reconnection feedback
- Faster perceived loading

---

# Code Architecture

## Requirements

- Reusable components
- Clean hooks
- Strict TypeScript
- UI/business separation
- Minimal prop drilling
- Consistent folder structure
- Shared design tokens

---

# Expected Final Result

The final application should feel like a premium SaaS application from 2026.

The UX should prioritize:

1. Mobile experience
2. Performance
3. Accessibility
4. Consistency
5. Perceived speed
6. Smooth interactions
7. Minimalism
8. Clarity
9. Native feeling
10. Touch ergonomics

---

# IMPLEMENTATION PROMPT

Refactor the entire existing React + Vite PWA using a modern UI architecture based on:

- Tailwind CSS v4
- DaisyUI
- Radix UI
- Radix Colors
- Framer Motion
- Lucide React

The current application uses:

- Top toolbar
- Expandable sidebar menu

Completely modernize the UI/UX while preserving all business logic and functionality.

The new interface must feel inspired by:

- Linear
- Vercel
- Raycast
- Stripe
- Discord
- Notion
- iOS 18

The application must be:

- Mobile-first
- Accessible
- Minimalist
- Fast
- Native-like
- Fluid
- Touch-friendly
- Consistent

Implement:

- Sticky blurred toolbar
- Modern collapsible sidebar
- Responsive drawer behavior on mobile
- Radix-based dropdowns/dialogs/tooltips
- DaisyUI custom themes using Radix Colors
- Smooth Framer Motion transitions
- Skeleton loading states
- Better spacing and typography
- Optimistic UI patterns
- Modern cards and forms
- Improved dark mode
- Better touch ergonomics
- Gesture-friendly interactions
- GPU accelerated animations
- Better route transitions
- Reduced visual clutter

Refactor all:

- Toolbar
- Sidebar
- Dropdowns
- Cards
- Forms
- Notifications
- Settings
- Modals
- Lists
- Tables
- Search UI
- Profile menus
- Mobile navigation

Ensure:

- WCAG accessibility
- Keyboard navigation
- Reduced re-renders
- Lazy loading
- Better performance
- Strict TypeScript
- Reusable architecture
- Consistent design tokens

Avoid:

- Bootstrap aesthetics
- Generic admin layouts
- Old Material UI patterns
- Heavy visual noise
- Harsh borders
- Pure black backgrounds
- Inconsistent spacing

The final result should feel like a premium modern SaaS PWA from 2026.

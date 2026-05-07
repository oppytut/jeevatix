# Tier 3 - Quality & Accessibility Implementation Plan

## Overview

Tier 3 focuses on improving test maintainability, visual regression testing, and accessibility compliance.

## Status: IN PROGRESS

### Completed:
- ✅ Directory structure created
- ✅ BasePage class implemented
- ✅ LoginPage example created

### Remaining Work:

---

## 3.1 Page Object Model (POM)

**Effort**: 2-3 days | **Priority**: High | **Impact**: Maintainability

### Structure:
```
tests/e2e/pages/
├── common/
│   ├── BasePage.ts          ✅ DONE
│   ├── NavigationComponent.ts
│   └── FormComponent.ts
├── buyer/
│   ├── LoginPage.ts          ✅ DONE
│   ├── HomePage.ts
│   ├── EventDetailPage.ts
│   ├── CheckoutPage.ts
│   ├── PaymentPage.ts
│   ├── OrdersPage.ts
│   └── TicketsPage.ts
├── seller/
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   ├── EventFormPage.ts
│   ├── EventListPage.ts
│   ├── TierManagementPage.ts
│   ├── OrdersPage.ts
│   └── CheckinPage.ts
└── admin/
    ├── LoginPage.ts
    ├── DashboardPage.ts
    ├── UserManagementPage.ts
    ├── SellerVerificationPage.ts
    └── CategoryManagementPage.ts
```

### Implementation Steps:

1. **Common Components** (4-6 hours)
   - NavigationComponent (header, sidebar)
   - FormComponent (reusable form interactions)
   - ModalComponent (dialogs, confirmations)

2. **Buyer Pages** (8-10 hours)
   - HomePage: event browsing, search, filters
   - EventDetailPage: event info, tier selection
   - CheckoutPage: reservation, quantity selection
   - PaymentPage: payment methods, order summary
   - OrdersPage: order history, filters
   - TicketsPage: ticket list, QR codes

3. **Seller Pages** (8-10 hours)
   - DashboardPage: stats, quick actions
   - EventFormPage: create/edit event
   - TierManagementPage: add/edit tiers
   - CheckinPage: QR scanner, manual check-in

4. **Admin Pages** (6-8 hours)
   - UserManagementPage: user list, actions
   - SellerVerificationPage: verify sellers
   - CategoryManagementPage: CRUD categories

5. **Refactor Existing Tests** (6-8 hours)
   - Update buyer-flow.spec.ts to use POM
   - Update seller-flow.spec.ts to use POM
   - Update admin-flow.spec.ts to use POM
   - Update Tier 1 & 2 tests to use POM

### Benefits:
- ✅ Reduced code duplication
- ✅ Easier maintenance
- ✅ Better test readability
- ✅ Centralized selector management
- ✅ Type-safe page interactions

### Example Usage:
```typescript
// Before (direct page interactions)
await page.goto('/login');
await page.getByLabel('Email').fill('user@example.com');
await page.getByLabel('Password').fill('password');
await page.getByRole('button', { name: 'Login' }).click();

// After (Page Object Model)
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login('user@example.com', 'password');
```

---

## 3.2 Visual Regression Testing

**Effort**: 1-2 days | **Priority**: Medium | **Impact**: UI Quality

### Setup:

1. **Install Dependencies**
```bash
# Already included in Playwright
# No additional dependencies needed
```

2. **Create Visual Test Suite**
```
tests/e2e/visual/
├── buyer-pages.visual.spec.ts
├── seller-pages.visual.spec.ts
├── admin-pages.visual.spec.ts
└── components.visual.spec.ts
```

3. **Screenshot Baseline**
```typescript
// tests/e2e/visual/buyer-pages.visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Buyer Pages Visual Regression', () => {
  test('homepage should match baseline', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('event detail page should match baseline', async ({ page }) => {
    await page.goto('/events/sample-event');
    await expect(page).toHaveScreenshot('event-detail.png');
  });

  test('checkout page should match baseline', async ({ page }) => {
    // Setup: login, navigate to checkout
    await expect(page).toHaveScreenshot('checkout.png');
  });
});
```

4. **Configuration**
```typescript
// playwright.config.ts
export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
});
```

### Test Coverage:
- **Buyer**: 15 pages × 2 viewports (desktop, mobile) = 30 screenshots
- **Seller**: 13 pages × 1 viewport (desktop) = 13 screenshots
- **Admin**: 16 pages × 1 viewport (desktop) = 16 screenshots
- **Components**: 10 key components = 10 screenshots
- **Total**: ~70 baseline screenshots

### Workflow:
1. Generate baselines: `pnpm exec playwright test --update-snapshots`
2. Run visual tests: `pnpm exec playwright test --project=visual`
3. Review diffs: Check `test-results/` for diff images
4. Update baselines: Re-run with `--update-snapshots` if changes are intentional

### Benefits:
- ✅ Catch unintended UI changes
- ✅ Prevent CSS regressions
- ✅ Document UI state
- ✅ Cross-browser consistency

---

## 3.3 Accessibility Testing

**Effort**: 1-2 days | **Priority**: High | **Impact**: Compliance

### Setup:

1. **Install axe-core**
```bash
pnpm add -D @axe-core/playwright
```

2. **Create Accessibility Test Suite**
```
tests/e2e/accessibility/
├── buyer-a11y.spec.ts
├── seller-a11y.spec.ts
├── admin-a11y.spec.ts
└── critical-flows-a11y.spec.ts
```

3. **Example Test**
```typescript
// tests/e2e/accessibility/buyer-a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Buyer Accessibility', () => {
  test('homepage should be accessible', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('event detail page should be accessible', async ({ page }) => {
    await page.goto('/events/sample-event');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('checkout flow should be keyboard navigable', async ({ page }) => {
    await page.goto('/checkout/sample-event');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Verify focus management
    const focusedElement = await page.evaluate(() => 
      document.activeElement?.tagName
    );
    expect(focusedElement).toBeTruthy();
  });
});
```

4. **WCAG Compliance Levels**
- Level A (minimum)
- Level AA (recommended) ✅ Target
- Level AAA (enhanced)

### Test Coverage:
- **All public pages**: WCAG 2.1 AA compliance
- **Authentication flows**: Keyboard navigation
- **Forms**: Label associations, error messages
- **Interactive elements**: Focus management, ARIA labels
- **Images**: Alt text validation
- **Color contrast**: Minimum 4.5:1 ratio

### Common Issues to Test:
- ✅ Missing alt text on images
- ✅ Insufficient color contrast
- ✅ Missing form labels
- ✅ Keyboard trap
- ✅ Missing ARIA labels
- ✅ Improper heading hierarchy
- ✅ Missing skip links
- ✅ Non-descriptive link text

### Benefits:
- ✅ WCAG 2.1 AA compliance
- ✅ Better UX for all users
- ✅ Legal compliance
- ✅ SEO improvements
- ✅ Keyboard navigation support

---

## Implementation Roadmap

### Week 1: Page Object Model
- Day 1-2: Common components + Buyer pages
- Day 3: Seller pages
- Day 4: Admin pages
- Day 5: Refactor existing tests

### Week 2: Visual & Accessibility
- Day 1: Visual regression setup + baselines
- Day 2: Visual tests for all portals
- Day 3: Accessibility setup + buyer tests
- Day 4: Accessibility tests for seller/admin
- Day 5: Documentation + final review

---

## Playwright Config Updates

```typescript
// playwright.config.ts additions
export default defineConfig({
  projects: [
    // ... existing projects ...
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /visual\/.*\.spec\.ts/,
    },
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /accessibility\/.*\.spec\.ts/,
    },
  ],
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
});
```

---

## Running Tier 3 Tests

```bash
# Run all Tier 3 tests
pnpm exec playwright test --project=visual --project=accessibility

# Visual regression only
pnpm exec playwright test --project=visual

# Update visual baselines
pnpm exec playwright test --project=visual --update-snapshots

# Accessibility only
pnpm exec playwright test --project=accessibility

# Generate accessibility report
pnpm exec playwright test --project=accessibility --reporter=html
```

---

## Success Metrics

### Page Object Model:
- ✅ 100% of tests use POM
- ✅ Zero direct page.locator() in test files
- ✅ All selectors centralized in page classes

### Visual Regression:
- ✅ 70+ baseline screenshots
- ✅ All critical pages covered
- ✅ Desktop + mobile viewports

### Accessibility:
- ✅ Zero WCAG 2.1 AA violations
- ✅ All forms keyboard navigable
- ✅ All images have alt text
- ✅ Proper ARIA labels

---

## Estimated Total Effort

| Task | Effort | Priority |
|------|--------|----------|
| Page Object Model | 2-3 days | High |
| Visual Regression | 1-2 days | Medium |
| Accessibility | 1-2 days | High |
| **Total** | **4-7 days** | |

---

## Next Steps

1. **Complete POM Implementation**
   - Finish all page classes
   - Refactor existing tests
   - Add type safety

2. **Setup Visual Testing**
   - Generate baselines
   - Configure thresholds
   - Document workflow

3. **Implement Accessibility**
   - Install axe-core
   - Create test suite
   - Fix violations

4. **Documentation**
   - Update README
   - Add contribution guide
   - Create troubleshooting guide

---

## Deliverables

- ✅ Complete Page Object Model
- ✅ 70+ visual regression tests
- ✅ WCAG 2.1 AA compliance
- ✅ Comprehensive documentation
- ✅ CI/CD integration ready

---

**Status**: Ready for implementation
**Last Updated**: 2026-05-06
**Owner**: Development Team

import { test } from '@playwright/test'
import { holdThroughSlide } from '../scale-hold'

// The held line at a device scale of 0.5, browser zoom under 100%. A device pixel is 2 CSS px here, so a write to an odd pixel reads back
// even. #348's first fix, a 1px tolerance, let the hold go at this scale: 105.63px median, 127.63px worst over 6 slides. Measurements and
// the reason this is a separate file: reader-scale-125.spec.ts. Control: hold-tolerance.
test.use({ viewport: null, launchOptions: { args: ['--force-device-scale-factor=0.5', '--window-size=1152,951'] } })

test('at a real device scale of 0.5 the line under the reader holds through a pane opening and closing', async ({ page }) => {
  await holdThroughSlide(page, .5, 1152, 1)
})

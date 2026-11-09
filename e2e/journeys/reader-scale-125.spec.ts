import { test } from '@playwright/test'
import { holdThroughSlide } from '../scale-hold'

// #345's review asked whether the held line survives a display scale of 125%, the common Windows setup. It did not, on dev or before it:
// the browser snaps a scroll write to its device pixels (3122.39990234375 for 3122.4), and the hold compared the place it read back with
// the sum it wrote, so it let go and a line re-picked mid-slide drifted. Worst per slide, 12 slides over 3 pages, in px:
//
//   scale   fecd354a3 (the carry)   v1.251.1 (no carry)   1px tolerance   v1.251.3 (heldAt is the read-back)
//   0.5                                                   127.63          1.50
//   1       0.97                    0.50                  0.50            0.50
//   1.25    54.41                   100.81                0.90            0.90
//   1.5     71.88                   21.45                 0.81            0.83
//   2                                                     0.50            0.49
//
// This file binds 1.25; reader-scale-050.spec.ts binds 0.5, browser zoom under 100%. The steps and the premises live in ../scale-hold.ts.
// Controls: hold-exact (heldAt back to the sum) dies here at 40.39px, on this journey's own line; a probe from its own pick read 100.81 to
// 126.41px, 3 of 3. hold-tolerance (the 1px form) dies in the 0.5 file. BLIND SPOT: 1.5 and 2 have no journey; 2 never failed.
// 951 is 864 plus the 87px the probe's windows carried, so this is the size the failure was measured at.
test.use({ viewport: null, launchOptions: { args: ['--force-device-scale-factor=1.25', '--window-size=1152,951'] } })

test('at a real device scale of 1.25 the line under the reader holds through a pane opening and closing', async ({ page }) => {
  await holdThroughSlide(page, 1.25, 1152, .3)
})

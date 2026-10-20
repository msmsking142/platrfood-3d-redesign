/** Gives Radix time to release its focus trap and body pointer-events after a modal closes. */
export function waitForCheckoutModalClose(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 150);
  });
}
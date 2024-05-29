export const Timer = (updateCallback, interval) => {
  const timer = {
    interval: interval,
    updateCallback: updateCallback,
    timerId: null,
    elapsedTime: 0,
    start() {
      if (!this.timerId) {
        this.timerId = setInterval(() => {
          this.elapsedTime += this.interval / 1000; // Update elapsed time
          this.updateCallback(this.elapsedTime); // Call the update callback with elapsed time
        }, this.interval);
      }
    },
    stop() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    },
  };

  return timer;
};

class SnapshotSandbox {
  windowSnapshot = {}
  modifiedMap = {}
  proxy = window;

  constructor() {
  }

  active() {
    // 记录 window 旧的 key-value
    Object.entries(window).forEach(([key, value]) => {
      this.windowSnapshot[key] = value;
    })

    // 恢复上一次的 key-value
    Object.keys(this.modifiedMap).forEach(key => {
      window[key] = this.modifiedMap[key];
    })
  }

  inactive() {
    this.modifiedMap = {};

    Object.keys(window).forEach(key => {
      // 如果有改动，则说明要恢复回来
      if (window[key] !== this.windowSnapshot[key]) {
        // 记录变更
        this.modifiedMap[key] = window[key];
        window[key] = this.windowSnapshot[key];
      }
    })
  }
}

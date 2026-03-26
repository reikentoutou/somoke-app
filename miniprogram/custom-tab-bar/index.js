Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/overview/overview', text: '概览', icon: 'grid' },
      { pagePath: '/pages/entry/entry',       text: '录入', icon: 'plus' },
      { pagePath: '/pages/reports/reports',    text: '报表', icon: 'chart' },
      { pagePath: '/pages/settings/settings',  text: '设置', icon: 'sliders' }
    ]
  },
  methods: {
    switchTab(e) {
      const idx = e.currentTarget.dataset.index;
      const item = this.data.list[idx];
      wx.switchTab({ url: item.pagePath });
    }
  }
});

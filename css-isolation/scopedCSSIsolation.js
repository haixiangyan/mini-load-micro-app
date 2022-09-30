// 多种规则
const RuleType = {
  STYLE: 1,
  MEDIA: 4,
  SUPPORTS: 12,
}

function ruleStyle(rule, prefix) {
  //匹配 p {..., a { ..., span {... 这类字符串
  return rule.cssText.replace(/^[\s\S]+{/, (selectors) => {
    // 匹配 div,body,span {... 这类字符串
    return selectors.replace(/(^|,\n?)([^,]+)/g, (selector, _, matchedString) => {
      // 将 p { => div[data-app-name=微应用名] p {
      return `${prefix} ${matchedString.replace(/^ */, '')}`;
    })
  });
}

function rewrite(rules, prefix) {
  let css = '';

  rules.forEach((rule) => {
    switch (rule.type) {
      case RuleType.STYLE:
        css += ruleStyle(rule, prefix);
        break;
      // case RuleType.MEDIA:
      //   css += this.ruleMedia(rule, prefix);
      //   break;
      // case RuleType.SUPPORTS:
      //   css += this.ruleSupport(rule, prefix);
      //   break;
      default:
        css += `${rule.cssText}`;
        break;
    }
  });

  return css;
}

function processCSS(appElement, stylesheetElement, appName) {
  // 生成 CSS 选择器：div[data-app-name=微应用名字]
  const prefix = `${appElement.tagName.toLowerCase()}[data-app-name="${appName}"]`;

  // 生成临时 <style> 节点
  const tempNode = document.createElement('style');
  document.body.appendChild(tempNode);
  tempNode.sheet.disabled = true

  if (stylesheetElement.textContent !== '') {
    // 将原来的 CSS 文本复制一份到临时 <style> 上
    const textNode = document.createTextNode(stylesheetElement.textContent || '');
    tempNode.appendChild(textNode);

    // 获取 CSS 规则
    const sheet = tempNode.sheet;
    const rules = [...sheet?.cssRules ?? []];

    // 生成新的 CSS 文本
    stylesheetElement.textContent = this.rewrite(rules, prefix);

    // 清理
    tempNode.removeChild(textNode);
  }
}

function scopedCSSIsolation(appName, contentHtmlString) {
  // 清理 HTML
  contentHtmlString = contentHtmlString.trim();

  // 创建一个容器 div
  const containerElement = document.createElement('div');
  // 生成内容 HTML 结构
  containerElement.innerHTML = contentHtmlString; // content 最高层级必需只有一个 div 元素

  // 获取根 div 元素
  const appElement = containerElement.firstChild;
  // 打上 data-app-name=appName 的标记
  appElement.setAttribute('data-app-name', appName);

  // 获取所有 <style></style> 元素内容，并将它们做替换
  const styleNodes = appElement.querySelectorAll('style') || [];
  [...styleNodes].forEach((stylesheetElement) => {
    processCSS(appElement, stylesheetElement, appName);
  })

  return appElement;
}

// // 测试
// const scopedCSSSection = document.querySelector('#scoped-css');
//
// const wrappedScopedCSSAppElement = scopedCSSIsolation('MyApp', `
//   <div class="wrapper">
//     <style>p { color: blue }</style>
//     <p>Scoped CSS Isolation</p>
//   </div>
// `);
//
// scopedCSSSection.appendChild(wrappedScopedCSSAppElement);

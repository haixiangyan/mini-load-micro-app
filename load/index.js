const ALL_SCRIPT_REGEX = /(<script[\s\S]*?>)[\s\S]*?<\/script>/gi;
const SCRIPT_SRC_REGEX = /.*\ssrc=(['"])?([^>'"\s]+)/;
const SCRIPT_ENTRY_REGEX = /.*\sentry\s*.*/;
const LINK_TAG_REGEX = /<(link)\s+.*?>/isg;
const STYLE_HREF_REGEX = /.*\shref=(['"])?([^>'"\s]+)/;

const isInlineCode = code => code.startsWith('<');

const getInlineCode = (match) => {
  const start = match.indexOf('>') + 1;
  const end = match.lastIndexOf('<');
  return match.substring(start, end);
}

// 将 <link> 转为 <style>/* CSS 代码 */ xx </style>
const genLinkReplaceSymbol = (linkHref, preloadOrPrefetch = false) => `<!-- ${preloadOrPrefetch ? 'prefetch/preload' : ''} link ${linkHref} replaced by import-html-entry -->`;

const processTpl = (html) => {
  let styles = [], scripts = [], entry = '';

  const template = html
    // 匹配 <link> 标签
    .replace(LINK_TAG_REGEX, match => {
      // <link rel = "stylesheet" href = "xxx" />
      const styleHref = match.match(STYLE_HREF_REGEX);
      // 获取 href 属性值
      const href = styleHref && styleHref[2];
      // 记录这里 href
      styles.push(href);
      // 源码会把这里变成注释，这里简化为直接干掉，变成空字符串
      return genLinkReplaceSymbol(href);
    })
    // 匹配 <script></script>
    .replace(ALL_SCRIPT_REGEX, (match, scriptTag) => {
      // 如果是外部的 script，通过是否包含 src 来判断
      if (scriptTag.match(SCRIPT_SRC_REGEX)) {
        // JS 入口 <script entry />
        const matchedScriptEntry = scriptTag.match(SCRIPT_ENTRY_REGEX);
        // <script src = "xx" />
        const matchedScriptSrcMatch = scriptTag.match(SCRIPT_SRC_REGEX);
        // 脚本地址
        let matchedScriptSrc = matchedScriptSrcMatch && matchedScriptSrcMatch[2];
        // 记录 script 的 src 地址
        scripts.push(matchedScriptSrc);
        // 记录入口（要么是匹配的入口，否则为最后一个 JS：当匹配到最后一个 JS 时，还没有 entry，那么最后一个 JS 视为入口）
        entry = entry || matchedScriptEntry && matchedScriptSrc;
        return match;
      }
      // 此时为内联 script 的情况
      else {
        scripts.push(match);
        return match;
      }
    })

  return { template, scripts, styles, entry }
}

const getExternalStyleSheets = (styles) => {
  return Promise.all(styles.map(styleLink => {
      return fetch(styleLink).then(response => response.text());
    }
  ));
}

function getExternalScripts(scripts) {
  // 遍历所有 script 的 src 地址
  return Promise.all(scripts.map(script => {
      // 字符串，要不是链接地址，要不是脚本内容（代码）
      if (isInlineCode(script)) {
        // 内联代码
        return getInlineCode(script);
      } else {
        // 外部代码，则加载脚本
        return fetch(script).then(response => response.text());
      }
    },
  ));
}

const getEmbedHtml = (template, styles) => {
  let embedHTML = template;

  return getExternalStyleSheets(styles, fetch)
    .then(styleSheets => {
      // 通过循环，将之前设置的 link 注释标签替换为 style 标签，即 <style>/* href地址 */ xx </style>
      embedHTML = styles.reduce((html, styleSrc, i) => {
        html = html.replace(genLinkReplaceSymbol(styleSrc), `<style>/* ${styleSrc} */${styleSheets[i]}</style>`);
        return html;
      }, embedHTML);
      return embedHTML;
    });
}

const execScripts = (scripts) => {
  // 激活沙箱
  window.sandbox.active();
  // 遍历执行 JS 代码
  getExternalScripts(scripts)
    .then(scriptText => {
      const code = `
        ;function fn (window) {
          ${scriptText}
        }
        fn(window.proxy);
      `

      eval(code);
    })
}

// JS 沙箱
window.sandbox = new SnapshotSandbox();
window.proxy = window.sandbox.proxy;

const loadMicroApp = async (containerSelector, name, url) => {
  // 获取 HTML
  const html = await (await fetch(url)).text();

  // 解析 html
  const { template, scripts, styles } = processTpl(html);

  // 远程加载所有外部样式，把 <link> 注释掉，再转化为 <style>
  const embedHtml = await getEmbedHtml(template, styles);

  // CSS 隔离
  const wrapped = `<div class="wrapper">${embedHtml}</div>`;
  const appElement = scopedCSSIsolation(name, wrapped);

  // 再追加包裹的内容
  const containerElement = document.querySelector(containerSelector);
  containerElement.appendChild(appElement);

  // 执行 JS
  execScripts(scripts);
}

const unloadMicroApp = async (containerSelector) => {
  // 清空内容
  document.querySelector(containerSelector).innerHTML = '';
  // 恢复环境
  window.sandbox.inactive();
}

// Editable, self-contained HTML: tables rather than CSS grid for email clients.
async function inlineImages(element: HTMLElement) {
  await Promise.all(Array.from(element.querySelectorAll('img')).map(async image => {
    const response = await fetch(image.src);
    if (!response.ok) throw new Error('Could not copy memo artwork.');
    const blob = await response.blob();
    image.src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
    });
  }));
}
export async function formattedMemo(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  const originals = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
  const copies = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
  const properties = ['font-family','font-size','font-weight','font-style','line-height','color','background-color','text-align','text-indent','white-space','width','height','min-height','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-top','border-right','border-bottom','border-left','box-sizing','object-fit'];
  copies.forEach((node, index) => {
    const original = originals[index]; if (!original) return;
    const style = getComputedStyle(original);
    properties.forEach(property => node.style.setProperty(property, style.getPropertyValue(property)));
    if (node.tagName !== 'IMG') { node.style.height = 'auto'; if (!node.matches('.memo-paper,.memo-body,.memo-table,.memo-footer')) node.style.width = 'auto'; }
    node.removeAttribute('contenteditable'); node.removeAttribute('role'); node.removeAttribute('aria-label'); node.removeAttribute('data-memo-block');
  });
  await inlineImages(clone);
  for (const wrapper of Array.from(clone.querySelectorAll<HTMLElement>('.memo-meta,.memo-row,.memo-address,.memo-date'))) {
    const table = document.createElement('table'); table.style.cssText = wrapper.style.cssText;
    table.style.borderCollapse = 'collapse'; table.style.tableLayout = 'fixed'; table.setAttribute('cellspacing','0'); table.setAttribute('cellpadding','0');
    const row = table.insertRow();
    for (const child of Array.from(wrapper.children)) {
      if (child.classList.contains('memo-ribbon')) continue;
      const cell = row.insertCell(); cell.style.verticalAlign = 'middle';
      if (wrapper.classList.contains('memo-row')) { cell.style.cssText = (child as HTMLElement).style.cssText; cell.style.width = row.cells.length === 1 ? '47.5%' : '52.5%'; cell.style.height = 'auto'; }
      if (wrapper.classList.contains('memo-meta')) cell.style.width = row.cells.length === 1 ? '72%' : '28%';
      if (wrapper.classList.contains('memo-letterhead')) cell.style.width = ['176px','360px','110px'][row.cells.length - 1] ?? 'auto';
      if (wrapper.classList.contains('memo-address')) cell.style.width = row.cells.length === 1 ? '34px' : '610px';
      if (wrapper.classList.contains('memo-date')) cell.style.width = row.cells.length === 1 ? '42px' : 'auto';
      cell.append(child);
      if (wrapper.classList.contains('memo-row')) { (child as HTMLElement).style.padding = '0'; (child as HTMLElement).style.border = '0'; }
    }
    const ribbon = wrapper.querySelector('.memo-ribbon'); if (ribbon) wrapper.before(ribbon);
    table.style.width = '100%'; table.style.height = 'auto';
    if (wrapper.classList.contains('memo-letterhead')) { table.style.width = '646px'; table.style.marginLeft = '74px'; table.style.padding = '0'; table.style.height = '142px'; }
    wrapper.replaceWith(table);
  }
  clone.style.margin = '0';clone.style.minHeight='0';
  for(const img of Array.from(clone.querySelectorAll('img'))){img.setAttribute('width',String(parseInt(img.style.width)||794));img.setAttribute('height',String(parseInt(img.style.height)||125));}
  const body=clone.querySelector<HTMLElement>('.memo-body');if(body)body.style.minHeight='0';
  return { html: clone.outerHTML, text: element.innerText };
}
export async function copyMemo(element: HTMLElement) {
  const native = (window as Window & { memoClipboard?: { write: (html: string, text: string) => Promise<void> } }).memoClipboard;
  const prepared = formattedMemo(element);
  if (native) { const {html,text}=await prepared;await native.write(html, text); return; }
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': prepared.then(({html})=>new Blob([html], { type:'text/html' })), 'text/plain':prepared.then(({text})=>new Blob([text], { type:'text/plain' })) })]); return; } catch { /* Fall back to a selected document and native copy event. */ }
  }
  const {html,text}=await prepared;
  const selection=window.getSelection();const range=document.createRange();range.selectNodeContents(element);selection?.removeAllRanges();selection?.addRange(range);
  let supplied=false;
  const copy = (event: ClipboardEvent) => { if(!event.clipboardData)return;event.preventDefault(); event.clipboardData.setData('text/html', html); event.clipboardData.setData('text/plain', text);supplied=true; };
  document.addEventListener('copy', copy);
  try { if (!document.execCommand('copy')||!supplied) throw new Error('Clipboard access was denied. Please allow copying and try again.');selection?.removeAllRanges(); }
  finally { document.removeEventListener('copy', copy); }
}
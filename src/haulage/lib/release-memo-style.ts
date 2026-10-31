// Isolated document styles also used in the export iframe, independent of the app theme.
export const memoStyle = `
.memo-paper *{box-sizing:border-box}
.memo-paper{width:794px;min-height:1123px;background:#fff;color:#000;font-family:'Bookman Old Style',Georgia,serif;font-size:16px;line-height:1.18;position:relative;}
.memo-letterhead{height:170px;position:relative;width:794px;display:flex;align-items:center;justify-content:space-between;padding:0;gap:0;}
.memo-header-image{display:block;width:794px;height:170px}.memo-footer-reference{display:block;width:794px;height:125px}
.memo-ribbon{position:absolute;top:0;left:0;width:255px;height:28px;}
.memo-logo{width:160px;height:84px;object-fit:contain}.memo-certification{width:110px;height:56px;object-fit:contain}
.memo-heading{text-align:center;flex:1;font-family:Arial,sans-serif}.memo-hindi{font-size:23px;color:#5297c8;font-weight:bold}.memo-hindi-subtitle{font-size:13px}.memo-title{font-size:15px;font-weight:bold;color:#5297c8;line-height:1.2}.memo-subtitle{font-size:12px;margin-top:3px}
.memo-body{width:644px;margin-left:74px;min-height:815px;}
.memo-meta{display:grid;grid-template-columns:1fr 180px;gap:10px;font-size:16px;font-weight:bold;padding-top:8px;padding-bottom:6px;border-top:1px solid #000;}
.memo-date{display:flex;gap:0;justify-content:flex-end}.memo-recipient{white-space:pre-wrap;padding-bottom:6px}.memo-subject{font-weight:bold;padding-bottom:8px}.memo-salutation{padding-bottom:3px}.memo-intro{text-align:justify;text-indent:42px;padding-bottom:0}
.memo-table{width:calc(100% - 8px);margin-left:8px;font-family:'Bookman Old Style',Georgia,serif;font-size:16px;line-height:1.05;}
.memo-row{display:grid;grid-template-columns:47.5% 52.5%;border-left:1px solid #000;border-right:1px solid #000;border-top:1px solid #000;min-height:21px}.memo-row:last-child{border-bottom:1px solid #000}.memo-row:nth-child(n+15){border-top:0}
.memo-cell{padding:1px 46px;white-space:pre-wrap;overflow-wrap:anywhere}.memo-cell+.memo-cell{border-left:1px solid #000}.memo-row:nth-child(6) .memo-cell:last-child,.memo-row:nth-child(8) .memo-cell:last-child{font-weight:bold}
.memo-note{padding-top:20px;padding-bottom:12px}.memo-signoff{text-align:right;font-weight:bold;white-space:pre-wrap;padding-top:6px;padding-bottom:12px}.memo-signature{padding-top:84px}
.memo-footer{width:794px;height:125px;background:#fff;padding:0;}.memo-address{display:flex;gap:20px;font-size:13px;align-items:flex-start;line-height:1.2}.memo-location{height:20px;width:14px;object-fit:contain}.memo-footer-image{display:block;width:644px;height:80px;object-fit:contain;margin-top:8px}
.memo-paper [contenteditable]{outline:none;white-space:pre-wrap;min-height:1em}.memo-paper [contenteditable]:focus{outline:1px dashed #5297c8;background:#f0f8ff}
`;
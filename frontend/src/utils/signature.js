export function buildSignatureHtml(settings, userEmail) {
  if (!settings.sigNameKo && !settings.sigPosition) return ''

  const p = (content, size, extra = '') =>
    `<p dir="ltr" style="line-height:1.2;margin-top:0;margin-bottom:0;font-family:'Noto Sans',sans-serif;font-size:${size};color:#000;${extra}">${content}</p>`

  let html = '<div>'

  // 이름 줄
  if (settings.sigNameKo) {
    let nameLine = `<span style="font-size:14pt;font-family:'Noto Sans',sans-serif;font-weight:bold;">${settings.sigNameKo}</span>`
    if (settings.sigNameEn) {
      nameLine += ` <span style="font-size:8pt;font-family:'Noto Sans',sans-serif;">${settings.sigNameEn}</span>`
    }
    html += p(nameLine, '14pt')
  }

  // 직위
  if (settings.sigPosition) {
    html += p(settings.sigPosition, '10pt')
  }

  html += '<br>'

  // 전화
  if (settings.sigPhone) {
    html += p(`T. ${settings.sigPhone}`, '10pt')
  }

  // 이메일 (링크)
  html += p(`E. <a href="mailto:${userEmail}" style="color:#000;">${userEmail}</a>`, '10pt')

  html += '<br>'

  // 주소
  html += p('서울 강남구 테헤란로57길 21 2층 | 02-533-7776', '8pt')

  // 추가 연락처
  if (settings.sigExtra) {
    // URL이 포함된 경우 링크 처리
    const formatted = settings.sigExtra.replace(
      /(https?:\/\/[^\s|]+)/g,
      '<a href="$1" style="color:rgb(17,85,204);text-decoration:underline;">$1</a>'
    ).replace(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '<a href="mailto:$1" style="color:#000;">$1</a>'
    )
    html += p(formatted, '8pt')
  }

  html += '<br>'

  // 로고
  if (settings.logoImageData) {
    html += `<p style="margin:0;line-height:1.2;"><img src="cid:signature_img" style="height:20px;width:auto;display:inline-block;"></p>`
  }

  html += '</div>'
  return html
}

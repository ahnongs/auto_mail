// 한글 이름 자동 띄어쓰기: 안홍서 → 안 홍 서
function spaceKoreanName(name) {
  if (!name || name.includes(' ')) return name
  return [...name].join(' ')
}

export function buildSignatureHtml(settings, userEmail) {
  if (!settings.sigNameKo && !settings.sigPosition) return ''

  const position = [
    settings.sigPosition,
    settings.sigRole ? `파트 ${settings.sigRole}` : ''
  ].filter(Boolean).join(' ')

  const nameKo = spaceKoreanName(settings.sigNameKo)

  const p = (content, size) =>
    `<p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;">${
      `<span style="font-size:${size};font-family:'Noto Sans',sans-serif;color:rgb(0,0,0);white-space:pre-wrap;">${content}</span>`
    }</p>`

  let html = '<div dir="ltr">'

  // 이름 줄
  let nameLine =
    `<span style="font-size:14pt;font-family:'Noto Sans',sans-serif;color:rgb(0,0,0);white-space:pre-wrap;"><b>${nameKo}</b></span>`
  if (settings.sigNameEn) {
    nameLine += ` <span style="font-size:8pt;font-family:'Noto Sans',sans-serif;color:rgb(0,0,0);white-space:pre-wrap;">${settings.sigNameEn}</span>`
  }
  html += `<p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;">${nameLine}</p>`

  // 직위
  if (position) html += p(position, '10pt')

  html += '<br>'

  // 전화
  if (settings.sigPhone) html += p(`T. ${settings.sigPhone}`, '10pt')

  // 이메일
  html += `<p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;">`
  html += `<span style="font-size:10pt;font-family:'Noto Sans',sans-serif;color:rgb(0,0,0);white-space:pre-wrap;">`
  html += `E. <a href="mailto:${userEmail}" target="_blank" style="color:rgb(0,0,0);">${userEmail}</a>`
  html += `</span></p>`

  html += '<br>'

  // 주소
  html += p('서울 강남구 테헤란로57길 21 2층 | 02-533-7776', '8pt')

  // 추가 연락처 (고정)
  html += `<p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;">`
  html += `<span style="font-size:8pt;font-family:'Noto Sans',sans-serif;color:rgb(0,0,0);white-space:pre-wrap;">`
  html += `<a href="mailto:james@eszett.co.kr" target="_blank" style="color:rgb(0,0,0);">james@eszett.co.kr</a> | `
  html += `</span>`
  html += `<a href="https://www.startdoctor.co.kr" target="_blank" style="text-decoration:none;">`
  html += `<span style="font-size:8pt;font-family:'Noto Sans',sans-serif;color:rgb(17,85,204);text-decoration:underline;white-space:pre-wrap;">https://www.startdoctor.co.kr</span>`
  html += `</a></p>`

  html += '<br>'

  // 로고 (실제 Gmail 서명과 동일한 wrapper 구조)
  if (settings.logoImageData) {
    html += `<p dir="ltr" style="line-height:1.2;margin-top:0pt;margin-bottom:0pt;">`
    html += `<span style="font-size:11pt;font-family:Arial,sans-serif;white-space:pre-wrap;">`
    html += `<span style="display:inline-block;overflow:hidden;width:81px;height:20px;">`
    html += `<img src="cid:signature_img" width="81" height="20" style="margin-left:0px;margin-top:0px;">`
    html += `</span></span></p>`
  }

  html += '</div>'
  return html
}

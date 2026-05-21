export function buildSignatureHtml(settings, userEmail) {
  if (!settings.sigNameKo && !settings.sigPosition) return ''

  let h = '<div style="font-family:\'Malgun Gothic\',\'맑은 고딕\',sans-serif;font-size:13px;color:#222;line-height:1.9;">'

  // 이름
  if (settings.sigNameKo) {
    h += `<div style="font-size:18px;font-weight:700;letter-spacing:4px;margin-bottom:2px;">`
    h += settings.sigNameKo
    if (settings.sigNameEn) {
      h += `<span style="font-size:13px;font-weight:400;color:#555;letter-spacing:0;margin-left:10px;">${settings.sigNameEn}</span>`
    }
    h += '</div>'
  }

  // 직위/파트
  if (settings.sigPosition) {
    h += `<div style="font-size:12px;color:#444;margin-bottom:8px;">${settings.sigPosition}</div>`
  }

  // 연락처
  h += '<div style="font-size:12px;color:#333;line-height:2;">'
  if (settings.sigPhone) h += `<div>T. ${settings.sigPhone}</div>`
  h += `<div>E. ${userEmail}</div>`
  h += '</div>'

  // 주소
  h += `<div style="font-size:11px;color:#888;margin-top:4px;">서울 강남구 테헤란로57길 21 2층 | 02-533-7776</div>`

  // 추가 연락처 (홈페이지 등)
  if (settings.sigExtra) {
    h += `<div style="font-size:11px;color:#888;">${settings.sigExtra}</div>`
  }

  h += '</div>'
  return h
}

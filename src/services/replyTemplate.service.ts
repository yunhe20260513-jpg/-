export function generateReply(matchedValues: string[], content: string) {
  const text = `${content} ${matchedValues.join(" ")}`;

  if (hasAny(text, ["卡紙", "夾紙", "一直卡紙", "送紙異常", "進紙輪"])) {
    return "如果是同一個位置反覆卡紙，通常不是紙的問題，可能是進紙輪或分離墊老化。可以先觀察是不是固定位置卡。";
  }

  if (hasAny(text, ["掃描不能用", "掃描失敗", "無法掃描"])) {
    return "如果列印正常但掃描不行，常見是網路或電腦端設定跑掉，不一定是機器本體壞。";
  }

  if (hasAny(text, ["列印很慢", "列印佇列", "列印失敗"])) {
    return "如果整間辦公室都變慢，可以先看網路與列印佇列；如果只有某台電腦慢，通常是驅動或連線設定。";
  }

  if (hasAny(text, ["租賃", "租影印機", "租事務機", "月租", "換廠商", "想換廠商", "不續約", "合約到期"])) {
    return "租賃主要要看月印量、彩色比例、維修反應時間與耗材是否包含，不一定月租最低就最划算。";
  }

  if (hasAny(text, ["維修等很久", "維修叫不來", "報修沒人來", "維修反應慢", "廠商不處理"])) {
    return "如果報修常常等很久，合約裡最好確認到場時間或替代機，不然公司忙的時候會很痛苦。";
  }

  return "這種狀況建議先分成機器本體、網路連線、電腦驅動三個方向看，才比較快判斷是要調整設定還是真的需要維修。";
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

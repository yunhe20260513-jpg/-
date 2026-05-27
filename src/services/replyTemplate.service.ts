export function generateReply(matchedValues: string[], content: string) {
  const text = `${content} ${matchedValues.join(" ")}`;

  if (!hasOfficeEquipmentSignal(text)) {
    return "";
  }

  if (hasAny(text, ["卡紙", "夾紙", "又卡紙", "一直卡紙"])) {
    return "如果是同一個位置反覆卡紙，通常不是紙的問題，可能是進紙輪或分離墊老化。可以先觀察是不是固定位置卡。";
  }

  if (hasAny(text, ["掃描不能用", "無法掃描", "掃描失敗", "掃描器"])) {
    return "如果列印正常但掃描不行，常見是網路或電腦端設定跑掉，不一定是機器本體壞。";
  }

  if (hasAny(text, ["列印很慢", "印很慢", "列印佇列"])) {
    return "如果整間辦公室都變慢，可以先看網路與列印佇列；如果只有某台電腦慢，通常是驅動或連線設定。";
  }

  if (hasAny(text, ["租賃", "租影印機", "想換廠商", "換租賃商", "租約到期", "合約快到"])) {
    return "租賃主要要看月印量、彩色比例、維修反應時間與耗材是否包含，不一定月租最低就最划算。";
  }

  if (hasAny(text, ["維修等很久", "報修沒人來", "廠商不處理", "維修太慢"])) {
    return "如果報修常常等很久，合約裡最好確認到場時間或替代機，不然公司忙的時候會很痛苦。";
  }

  return "可以先確認目前是租賃機還是自購機、月印量大概多少，以及問題是單台電腦還是整間辦公室都會發生，這樣比較容易判斷該修、換機或重談合約。";
}

export function hasOfficeEquipmentSignal(text: string) {
  return hasAny(text, [
    "影印機",
    "事務機",
    "複合機",
    "印表機",
    "雷射印表機",
    "掃描器",
    "列印",
    "掃描",
    "OA",
    "租影印機",
    "事務機租賃",
    "印表機租賃"
  ]);
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

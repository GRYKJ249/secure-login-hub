/** Turns a raw image-provider failure into a clear bilingual message. */
export function describeImageFailure(status: number, detail: string): string {
  const text = detail.toLowerCase();

  if (/copyright|trademark|intellectual property|celebrit|public figure|likeness|brand/.test(text)) {
    return "تم رفض الطلب لأنه قد يتضمن محتوى محمي بحقوق نشر أو علامة تجارية. اكتب فكرة أصلية وحاول مرة أخرى. | This request was declined because it may involve copyrighted or trademarked content. Describe an original idea and try again.";
  }
  if (/safety|moderation|content_policy|content policy|content filter|unsafe|violat|refus|blocked|not allowed|rejected/.test(text)) {
    return "تعذّر إنشاء الصورة لأن الوصف لا يتوافق مع قواعد أمان المحتوى. عدّل الوصف وحاول مرة أخرى. | This image could not be created because the description conflicts with content safety rules. Adjust it and try again.";
  }
  if (status === 429) {
    return "الطلبات كثيرة الآن. انتظر قليلاً ثم حاول مرة أخرى. | Too many requests right now. Please wait a moment and try again.";
  }
  if (status === 402) {
    return "رصيد توليد الصور غير كافٍ. | Not enough credits to generate images.";
  }
  return "تعذّر توليد الصورة حالياً. حاول مرة أخرى. | We couldn't generate the image right now. Please try again.";
}

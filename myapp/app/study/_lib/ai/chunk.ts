var CHUNK_SIZE = 600;
var OVERLAP = 60;

function chunkPages(
  pages: { page: number; text: string }[],
  chunkSize: number | null,
  overlap: number | null
): { page: number; chunkIndex: number; text: string }[] {
  var size = chunkSize || CHUNK_SIZE;
  var ov = overlap || OVERLAP;
  var step = size - ov;
  var result: { page: number; chunkIndex: number; text: string }[] = [];
  for (var p = 0; p < pages.length; p++) {
    var page = pages[p];
    var words = page.text.split(" ");
    for (var i = 0; i < words.length; i = i + step) {
      var end = i + size;
      if (end > words.length) {
        end = words.length;
      }
      var chunkText = words.slice(i, end).join(" ");
      if (chunkText.trim().length > 0) {
        result.push({
          page: page.page,
          chunkIndex: result.length,
          text: chunkText
        });
      }
      if (end === words.length) {
        break;
      }
    }
  }
  return result;
}

export { chunkPages };

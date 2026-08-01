var CHUNK_SIZE = 600;
var OVERLAP = 60;
var STEP = CHUNK_SIZE - OVERLAP;

function chunkPages(
  pages: { page: number; text: string }[]
): { page: number; chunkIndex: number; text: string }[] {
  var result: { page: number; chunkIndex: number; text: string }[] = [];

  for (var pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    var currentPage = pages[pageIndex];
    var words = currentPage.text.split(" ");

    for (var offset = 0; offset < words.length; offset = offset + STEP) {
      var end = offset + CHUNK_SIZE;

      if (end > words.length) {
        end = words.length;
      }

      var chunkText = words.slice(offset, end).join(" ");

      if (chunkText.trim().length > 0) {
        result.push({
          page: currentPage.page,
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

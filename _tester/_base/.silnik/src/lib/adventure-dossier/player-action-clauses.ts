/** Exact envelope produced by the Hot Seat composer; speaker resolution remains roster-bound. */
export function playerActionSegments(message: string): Array<{speaker?:string;text:string}> {
  const markers=[...message.matchAll(/(?:^|;\s*)(?:Gracz|Player)\s+\d+\s+\(@([^)]*)\):\s*/gi)];
  if (!markers.length || markers[0].index!==0) return [{text:message}];
  return markers.map((marker,index)=>({speaker:marker[1],text:message.slice(marker.index!+marker[0].length,markers[index+1]?.index).trim()}));
}

/** A fronted physical source is not the object: "biorę z biurka fotografię". */
export function stripLeadingMaterialSource(text:string):string {
  return text.replace(/^(?:(?:z|ze)\s+(?:biurka|stolu|teczki|torby|szuflady|dloni)|from\s+(?:the\s+)?(?:desk|table|folder|bag|drawer))\s+/,'');
}

/** Keep questions local to their sentence instead of cancelling the entire turn. */
export function playerActionSentences(message: string): string[] {
  const unquoted = playerActionSegments(message).map(segment=>segment.text).join('; ').replace(/„[^”]*”|“[^”]*”|"[^"]*"|«[^»]*»/g, '');
  return (unquoted.match(/[^.!?;]+[.!?;]*/g) ?? [])
    .filter(sentence => !sentence.includes('?'))
    .map(sentence => sentence.replace(/[.!;\n]+$/, '').trim())
    .filter(Boolean);
}

/**
 * Utility to export graph data to GEXF (Gephi) format.
 */
export function exportToGexf(nodes: any[], links: any[]): string {
  const timestamp = new Date().toISOString();
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
    <meta lastmodifieddate="${timestamp.split('T')[0]}">
        <creator>Coincidence Laboratory Narrative Engine</creator>
        <description>Knowledge Graph Export</description>
    </meta>
    <graph mode="static" defaultedgetype="directed">
        <nodes>
`;

  nodes.forEach(node => {
    const label = node.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    xml += `            <node id="${node.id}" label="${label}">
                <attvalues>
                    <attvalue for="type" value="${node.type}" />
                </attvalues>
            </node>\n`;
  });

  xml += `        </nodes>
        <edges>
`;

  links.forEach((link, idx) => {
    const label = (link.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    xml += `            <edge id="e${idx}" source="${link.source.id || link.source}" target="${link.target.id || link.target}" label="${label}" />\n`;
  });

  xml += `        </edges>
    </graph>
</gexf>`;

  return xml;
}

export function downloadFile(content: string, fileName: string, contentType: string) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}

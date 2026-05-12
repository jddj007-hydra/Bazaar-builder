import type { BoardLayout, ItemIndexEntry } from "./lib/bazaar-data/types";

type BoardPreviewProps = {
  layout: BoardLayout;
  itemById: Map<string, ItemIndexEntry>;
};

export function BoardPreview({ layout, itemById }: BoardPreviewProps) {
  const occupiedSlots = new Set(layout.placements.flatMap((placement) => {
    return Array.from({ length: placement.size }, (_, index) => placement.startSlot + index);
  }));

  return (
    <section className="board-preview" aria-label="优化棋盘布局">
      <div className="board-preview-heading">
        <h3>棋盘布局</h3>
        <strong>{layout.layoutScore}</strong>
      </div>
      <div className="board-grid" style={{ gridTemplateColumns: `repeat(${layout.slotLimit}, minmax(0, 1fr))` }}>
        {Array.from({ length: layout.slotLimit }, (_, slot) => (
          <div
            aria-hidden="true"
            className={`board-slot${occupiedSlots.has(slot) ? " occupied" : ""}`}
            key={`slot-${slot}`}
            style={{ gridColumn: `${slot + 1} / span 1`, gridRow: 1 }}
          >
            {slot + 1}
          </div>
        ))}
        {layout.placements.map((placement) => {
          const item = itemById.get(placement.itemId);
          return (
            <div
              className="board-item"
              key={`${placement.itemId}-${placement.startSlot}`}
              style={{ gridColumn: `${placement.startSlot + 1} / span ${placement.size}`, gridRow: 1 }}
              title={`${placement.itemName}，${placement.size} 格，占用 ${placement.startSlot + 1}-${placement.endSlot + 1}`}
            >
              {item?.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : null}
              <span>{placement.itemName}</span>
              <small>{placement.size}格</small>
            </div>
          );
        })}
      </div>
      {layout.reasons.length > 0 ? (
        <ul className="layout-notes">
          {layout.reasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {layout.warnings.length > 0 ? (
        <div className="layout-warnings">
          {layout.warnings.slice(0, 2).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

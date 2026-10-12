import { View } from "react-native";
import type { L2Book } from "@/lib/kuru";
import { c, Label, Mono, Row } from "./ui";

/** Depth ladder: asks above the spread, bids below, with depth bars scaled to the largest level. */
export function OrderBookView({ book, rows = 8 }: { book: L2Book; rows?: number }) {
  const asks = book.asks.slice(0, rows).reverse();
  const bids = book.bids.slice(0, rows);
  const max = Math.max(1, ...asks.map((l) => l.size), ...bids.map((l) => l.size));
  const spread = book.asks[0] && book.bids[0] ? book.asks[0].price - book.bids[0].price : null;

  const line = (price: number, size: number, color: string, key: string) => (
    <View key={key} style={{ height: 22, justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 2,
          bottom: 2,
          width: `${(size / max) * 100}%`,
          backgroundColor: color,
          opacity: 0.14,
          borderRadius: 3,
        }}
      />
      <Row style={{ justifyContent: "space-between", paddingHorizontal: 6 }}>
        <Mono color={color}>{price.toFixed(4)}</Mono>
        <Mono color={c.dim}>{size.toFixed(2)}</Mono>
      </Row>
    </View>
  );

  return (
    <View>
      <Row style={{ justifyContent: "space-between", paddingHorizontal: 6 }}>
        <Label>Price (AUSD/hr)</Label>
        <Label>GPU-hours</Label>
      </Row>
      {asks.length === 0 ? <Label style={{ paddingHorizontal: 6 }}>No asks</Label> : asks.map((l, i) => line(l.price, l.size, c.ask, `a${i}`))}
      <Row style={{ justifyContent: "center", paddingVertical: 4 }}>
        <Label>{spread === null ? "—" : `Spread ${spread.toFixed(4)} · block ${book.block}`}</Label>
      </Row>
      {bids.length === 0 ? <Label style={{ paddingHorizontal: 6 }}>No bids</Label> : bids.map((l, i) => line(l.price, l.size, c.bid, `b${i}`))}
    </View>
  );
}

/// OQL value instance for `Common.BusinessKind`.
import OQL "mo:caffeineai-oql";
import Common "types/common";

module {
  public func _toRow(self : Common.BusinessKind) : OQL.Value =
    #text(
      switch (self) {
        case (#revenue) { "revenue" };
        case (#cost) { "cost" };
      }
    );
};

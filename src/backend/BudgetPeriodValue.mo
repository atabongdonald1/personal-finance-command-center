/// OQL value instance for `Common.BudgetPeriod`.
import OQL "mo:caffeineai-oql";
import Common "types/common";

module {
  public func _toRow(self : Common.BudgetPeriod) : OQL.Value =
    #text(
      switch (self) {
        case (#daily) { "daily" };
        case (#weekly) { "weekly" };
        case (#monthly) { "monthly" };
        case (#annual) { "annual" };
      }
    );
};

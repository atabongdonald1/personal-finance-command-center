/// OQL value instance for `Common.EntryKind`.
///
/// The OQL resolver looks up `_toRow` for each record field type by importing a
/// module named `<TypeName>Value` top-level in the file that declares entities.
/// A variant has no built-in instance, so this module renders the tag as text.
import OQL "mo:caffeineai-oql";
import Common "types/common";

module {
  public func _toRow(self : Common.EntryKind) : OQL.Value =
    #text(
      switch (self) {
        case (#income) { "income" };
        case (#expense) { "expense" };
      }
    );
};

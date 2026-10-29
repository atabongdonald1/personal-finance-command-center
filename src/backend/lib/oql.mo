import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

/// Row-source helpers for the OQL entities.
///
/// Ledgerly stores each collection as `Map<Principal, Map<RecordId, Record>>`
/// so per-user isolation is enforced by the domain mixins. OQL entities iterate
/// records, not inner maps, so these helpers flatten the nested owner maps into
/// a single iterator of records. Each record already carries its `owner`
/// principal, which the entity uses as its owner column.
module {
  /// Flatten `Map<Principal, Map<K, V>>` into an iterator over every `V`.
  public func flatten<K, V>(
    outer : Map.Map<Principal, Map.Map<K, V>>,
  ) : Iter.Iter<V> {
    outer.values().flatMap(func(inner) = inner.values());
  };
};

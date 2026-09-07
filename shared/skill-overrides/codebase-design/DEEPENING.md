# Deepening a Cluster

Start with the behavior callers need and the dependencies that make it hard to
provide. Group responsibilities that change together; keep independent lifecycles
or ownership separate.

Place the public interface where callers can use the behavior without knowing
internal sequencing. Keep external systems behind an adapter when that isolates
a real integration contract. Internal functions and tests may remain small.

Compare the proposed boundary with a simpler direct implementation. Prefer it
when it reduces caller knowledge or concentrates changes. Do not add fake adapters
merely to demonstrate that an interface could have multiple implementations.

Preserve tests that protect observable behavior. Replace implementation-coupled
tests only when equivalent or stronger behavioral evidence remains.

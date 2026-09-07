#!/usr/bin/env python3
# Reads `claude -p --output-format json` output from stdin, persists the
# session id for a later --resume-last round, and prints the reply text.
import json
import os
import sys


def main():
    if len(sys.argv) != 2:
        print("usage: extract-claude-result.py STATE_FILE < json", file=sys.stderr)
        sys.exit(2)

    state_file = sys.argv[1]
    data = json.load(sys.stdin)

    if data.get("is_error"):
        print(data.get("result") or "(claude reported an error with no message)", file=sys.stderr)
        sys.exit(1)

    session_id = data.get("session_id", "")
    if session_id:
        tmp_file = f"{state_file}.tmp.{os.getpid()}"
        with open(tmp_file, "w") as f:
            f.write(session_id)
        os.replace(tmp_file, state_file)

    print(data.get("result", ""))


if __name__ == "__main__":
    main()

from typing import Literal

ReactionKind = Literal["empathy", "insight", "curious"]
REACTION_KINDS: tuple[ReactionKind, ...] = ("empathy", "insight", "curious")

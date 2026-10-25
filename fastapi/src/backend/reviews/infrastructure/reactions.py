from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..application.results import ReactionSummary
from ..domain.reactions import REACTION_KINDS, ReactionKind
from .models import ReviewReaction


class SqlReactionRepository:
    def __init__(self, db: Session):
        self.db = db

    def summary(self, review_id: int, user_id: int) -> ReactionSummary:
        rows = self.db.execute(
            select(
                ReviewReaction.kind,
                func.count(),
                func.max(case((ReviewReaction.user_id == user_id, 1), else_=0)),
            )
            .where(ReviewReaction.review_id == review_id)
            .group_by(ReviewReaction.kind)
        )
        counts: dict[ReactionKind, int] = dict.fromkeys(REACTION_KINDS, 0)
        mine: ReactionKind | None = None
        for kind, count, selected in rows:
            counts[kind] = count
            if selected:
                mine = kind
        return ReactionSummary(review_id, counts, mine)

    def set(self, review_id: int, user_id: int, kind: ReactionKind | None) -> None:
        row = self.db.get(ReviewReaction, (review_id, user_id))
        if kind is None:
            if row is not None:
                self.db.delete(row)
        elif row is None:
            self.db.add(ReviewReaction(review_id=review_id, user_id=user_id, kind=kind))
        else:
            row.kind = kind
        self.db.flush()

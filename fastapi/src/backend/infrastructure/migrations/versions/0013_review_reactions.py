"""Store one reaction per reader and review."""

import sqlalchemy as sa
from alembic import op

revision = "0013_review_reactions"
down_revision = "0012_public_display_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "review_reactions",
        sa.Column("review_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(7), nullable=False),
        sa.PrimaryKeyConstraint("review_id", "user_id"),
        sa.ForeignKeyConstraint(["review_id"], ["page_reviews.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "kind IN ('empathy', 'insight', 'curious')", name="ck_review_reactions_kind"
        ),
    )
    op.create_index("ix_review_reactions_user_id", "review_reactions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_review_reactions_user_id", table_name="review_reactions")
    op.drop_table("review_reactions")

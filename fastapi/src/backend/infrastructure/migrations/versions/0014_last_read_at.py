"""Record explicit reading activity without guessing past timestamps."""

import sqlalchemy as sa
from alembic import op

revision = "0014_last_read_at"
down_revision = "0013_review_reactions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_books", sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        "ix_user_books_recent_reading", "user_books", ["user_id", "status", "last_read_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_books_recent_reading", table_name="user_books")
    op.drop_column("user_books", "last_read_at")

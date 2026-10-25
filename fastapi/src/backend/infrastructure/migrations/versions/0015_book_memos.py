"""Store private per-reader, per-book memos independently of reading iterations."""

import sqlalchemy as sa
from alembic import op

revision = "0015_book_memos"
down_revision = "0014_last_read_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "book_memos",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "book_id"),
        sa.CheckConstraint("length(content) <= 10000", name="ck_book_memos_content_length"),
    )


def downgrade() -> None:
    op.drop_table("book_memos")

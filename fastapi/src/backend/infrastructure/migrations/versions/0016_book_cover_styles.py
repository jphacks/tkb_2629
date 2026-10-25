"""Private book cover preferences, independent of reading iterations."""

import sqlalchemy as sa
from alembic import op

revision = "0016_book_cover_styles"
down_revision = "0015_book_memos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "book_cover_styles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("color_mode", sa.String(16), nullable=False),
        sa.Column("palette", sa.Integer(), nullable=True),
        sa.Column("pattern", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "book_id"),
        sa.CheckConstraint(
            "color_mode IN ('auto', 'palette', 'mine', 'others')",
            name="ck_book_cover_styles_mode",
        ),
        sa.CheckConstraint(
            "(color_mode = 'palette' AND palette IS NOT NULL AND palette BETWEEN 0 AND 7) "
            "OR (color_mode != 'palette' AND palette IS NULL)",
            name="ck_book_cover_styles_palette",
        ),
        sa.CheckConstraint(
            "pattern IS NULL OR pattern BETWEEN 0 AND 3", name="ck_book_cover_styles_pattern"
        ),
    )


def downgrade() -> None:
    op.drop_table("book_cover_styles")

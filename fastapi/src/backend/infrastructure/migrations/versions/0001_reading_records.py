import sqlalchemy as sa
from alembic import op

revision = "0001_reading_records"
down_revision = None
branch_labels = None
depends_on = None
BASELINE_TABLES = {"users", "books", "user_books", "page_reviews", "emotion_analyses"}


def _create_users_if_missing() -> None:
    if not sa.inspect(op.get_bind()).has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.UniqueConstraint("email"),
        )


def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names()) & BASELINE_TABLES
    if existing_tables:
        names = ", ".join(sorted(existing_tables))
        raise RuntimeError(
            "Refusing to baseline existing tables without Alembic history "
            f"({names}). Verify the schema, then explicitly stamp revision 0001."
        )

    _create_users_if_missing()
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("books"):
        op.create_table(
            "books",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("author", sa.String(length=255), nullable=True),
            sa.Column("total_pages", sa.Integer(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.CheckConstraint("length(trim(title)) > 0", name="ck_books_title_nonempty"),
            sa.CheckConstraint("total_pages >= 1", name="ck_books_total_pages_positive"),
        )
    if not inspector.has_table("user_books"):
        op.create_table(
            "user_books",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("book_id", sa.Integer(), nullable=False),
            sa.Column("current_page", sa.Integer(), server_default="0", nullable=False),
            sa.Column("status", sa.String(length=16), server_default="reading", nullable=False),
            sa.Column(
                "started_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("user_id", "book_id", name="uq_user_books_user_book"),
            sa.CheckConstraint("current_page >= 0", name="ck_user_books_current_page_nonnegative"),
            sa.CheckConstraint("status IN ('reading', 'completed')", name="ck_user_books_status"),
            sa.CheckConstraint(
                "status != 'completed' OR completed_at IS NOT NULL",
                name="ck_user_books_completed_at",
            ),
        )
        op.create_index("ix_user_books_book_id", "user_books", ["book_id"])
    if not inspector.has_table("page_reviews"):
        op.create_table(
            "page_reviews",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_book_id", sa.Integer(), nullable=False),
            sa.Column("page_number", sa.Integer(), nullable=False),
            sa.Column("review_text", sa.Text(), nullable=False),
            sa.Column("analysis_revision", sa.Integer(), server_default="1", nullable=False),
            sa.Column(
                "analysis_status", sa.String(length=16), server_default="pending", nullable=False
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_book_id"], ["user_books.id"], ondelete="CASCADE"),
            sa.UniqueConstraint(
                "user_book_id", "page_number", name="uq_page_reviews_user_book_page"
            ),
            sa.CheckConstraint("page_number > 0", name="ck_page_reviews_page_number_positive"),
            sa.CheckConstraint(
                "length(trim(review_text)) > 0", name="ck_page_reviews_text_nonempty"
            ),
            sa.CheckConstraint(
                "analysis_status IN ('pending', 'completed', 'failed')",
                name="ck_page_reviews_analysis_status",
            ),
        )
        op.create_index("ix_page_reviews_user_book_id", "page_reviews", ["user_book_id"])
    if not inspector.has_table("emotion_analyses"):
        op.create_table(
            "emotion_analyses",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("review_id", sa.Integer(), nullable=False),
            sa.Column("review_revision", sa.Integer(), nullable=False),
            sa.Column("emotion_label", sa.String(length=64), nullable=False),
            sa.Column("color_code", sa.String(length=7), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("model_version", sa.String(length=128), nullable=True),
            sa.Column("source", sa.String(length=16), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["review_id"], ["page_reviews.id"], ondelete="CASCADE"),
            sa.UniqueConstraint(
                "review_id", "review_revision", name="uq_emotion_analyses_review_revision"
            ),
            sa.CheckConstraint("source IN ('mock', 'jev')", name="ck_emotion_analyses_source"),
            sa.CheckConstraint(
                "length(color_code) = 7 AND substr(color_code, 1, 1) = '#'",
                name="ck_emotion_analyses_color_code",
            ),
            sa.CheckConstraint(
                "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
                name="ck_emotion_analyses_confidence",
            ),
        )
        op.create_index("ix_emotion_analyses_review_id", "emotion_analyses", ["review_id"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = ("emotion_analyses", "page_reviews", "user_books", "books")
    for table in tables:
        if sa.inspect(bind).has_table(table):
            has_rows = bind.execute(sa.text(f"SELECT EXISTS (SELECT 1 FROM {table})")).scalar_one()
            if has_rows:
                raise RuntimeError(f"Refusing to drop non-empty table {table}")
    for table in tables:
        if sa.inspect(bind).has_table(table):
            op.drop_table(table)

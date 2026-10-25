"""Interactive CLI boundary; the composition root supplies the use case."""

import argparse
import getpass
import sys
from collections.abc import Callable

from pydantic import ValidationError

from ..application.development import DevelopmentUserProvisioner
from ..application.errors import IdentityServiceUnavailable
from ..domain.errors import IdentityError
from .schemas import EmailInput


def run(factory: Callable[[], DevelopmentUserProvisioner]) -> int:
    parser = argparse.ArgumentParser(
        description="開発用ユーザーをDBへ作成・更新し、メール確認済みにします。既存のパスワードは更新されます。"
    )
    parser.add_argument("--email", required=True, help="ログインに使用するメールアドレス")
    parser.add_argument(
        "--name", help="表示名。省略時は既存名を維持し、新規なら開発ユーザーにします"
    )
    parser.add_argument(
        "--password-stdin", action="store_true", help="パスワードを標準入力の1行目から読み込む"
    )
    args = parser.parse_args()
    try:
        service = factory()
        email = str(EmailInput(email=args.email).email)
        if args.password_stdin:
            password = sys.stdin.readline().rstrip("\r\n")
        else:
            if not sys.stdin.isatty():
                parser.error("対話端末で実行するか、--password-stdinを指定してください")
            password = getpass.getpass("ログイン用パスワード（12〜128文字）: ")
            confirmation = getpass.getpass("パスワード（確認）: ")
            if password != confirmation:
                parser.error("パスワードが一致しません")
        user = service.provision(email, password, args.name)
    except ValidationError:
        print("メールアドレスの形式を確認してください", file=sys.stderr)
        return 1
    except (IdentityError, IdentityServiceUnavailable) as error:
        print(str(error), file=sys.stderr)
        return 1
    except (EOFError, KeyboardInterrupt):
        print("\nユーザー作成を中止しました", file=sys.stderr)
        return 130
    print(f"開発用ユーザーを保存しました: id={user.id}, email={user.email}, name={user.name}")
    print("メール確認済みです。アプリのログイン画面から入力したパスワードでログインできます。")
    return 0

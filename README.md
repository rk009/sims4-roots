# Sims4 Roots

Windows用の家系図アプリです。Sims4Roots.exe と同じフォルダーに characters.json、families.json、worlds.json を置いて起動してください。下書きは .app-data/webview に保存されます。

## 設定ファイル

- characters.json: 人物の配列。characterName、displayName、mainFamily、occult、star、image、father、mother、children、partners（characterName と status）を設定します。mainFamily にはメイン世帯の familyName を指定します。親が不明な兄弟は father または mother に同じ `noparents_識別名` を設定します。
- families.json: 家族の配列。familyName は一意の識別名、displayName は表示名です。world、members、formerMembers、pets、petImages、image、background、theme も設定できます。members と formerMembers は characterName の配列です。formerMembers は家を出たシムで、右上の家アイコンからメイン世帯へ移動できます。家族の編集画面で members との間を移動できます。
- worlds.json: ファミリー追加・編集画面のワールド候補。各項目の world に表示名を記述します。変更後はアプリを再起動するか「再読み込み」を押してください。
- 同じ characterName の個人情報と兄弟順は家族間で共有されます。
- member: true のパートナーは同じ大きさで右に表示します。members: true も読み込み可能です。省略時は小さく縦に表示します。
- 関係 status には love_marriage（恋愛結婚）、marriage_of_convenience（見合い結婚）、summser_fling（ひと夏の恋）、friendzone_right（片思い）、friendzone_left（一方通行）、flirting（浮気）、family（その他）も使えます。オカルトには servo と plant_sim も使えます。
- 末尾カンマのある手編集ファイルも読み込めます。保存時は標準JSONになります。
- characters.json に未登録の所属人物は名前で表示し、確認事項に表示します。

## 操作

左のリボンで家族を切り替えます。アイコンをドラッグするとファミリーの順序を変更でき、「JSONを保存」で families.json にその順序を書き込みます。人物をクリックして右ペインで編集し、「変更を反映」を押してください。ペットは家族の編集画面で設定し、家系図の右上に表示します。

起動時にアプリと同じフォルダーのJSONを読み込みます。「再読み込み」は両方の外部変更を反映します。「JSONを保存」（Ctrl+S）は両方に書き戻します。

ブラウザー版では保存時に2ファイルをダウンロードします。両方を同じフォルダーに保管してください。

設定画面で背景を変更できます。「画像を書き出す」で家系図全体をPNGに保存します。画像はJSON内に埋め込まれます。

## 開発

npm.cmd run dev / npm.cmd run check / npm.cmd test / npm.cmd run test:ui

### ブラウザでの確認

```
npm.cmd run dev
```

ブラウザで [localhost](http://localhost:1420)にアクセスする


### exeの作成

src-tauri/target/release/sims4-roots.exe を生成します。開発時の外部設定は release 内の2ファイルを使用します。

```
npm.cmd run desktop:build
```

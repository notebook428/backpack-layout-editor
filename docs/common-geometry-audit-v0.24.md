# 共通アイテム形状監査メモ（v0.24.0時点）

2026-10-19 / エディタ本体 `index.html` の定義から機械的に抽出。
本資料は監査対象の整理であり、原作の実機検証ではありません。

## 件数
- `common-` プレフィックスの定義数: 148
- 形状・☆について「暫定／未確認／未照合」の記述がある定義: 107
- `stars:null`（☆が未検証）の定義: 118
- `pending:true`（配置不可）の定義: 1

## 監査の優先順位
1. 暫定形状を実機スクリーンショットと照合し、占有マスを確定する。
2. ☆・◆・◇などの位置は画像で裏付けられたものだけ登録する。
3. 別名・派生品の取り違えと重複を検査する。
4. `stars:null` と `stars:[]` を区別して保持する。

## 特に先に確認したい項目
- 羊飼いの杖：外接2×4は記載済みだが、占有5マスL字と☆6個の座標は未照合。
- びっくりサック：開始時に置換される特殊バッグで、配置不可のままが適切。
- 共通スキル：暫定1マスが含まれるため、原作上のアイテム形状と混同しない。

## 要検証プリセット一覧（先頭50件）

- `common-shepherds-crook` 羊飼いの杖
- `common-skill-more-power` もっと力を！
- `common-skill-time-melting` 時間融解
- `common-skill-full-body-protection` 全身防備
- `common-skill-animal-dialogue` 動物との対話
- `common-skill-glittering-king` キンキラ・キング
- `common-skill-deal-struck` 交渉成立
- `common-skill-echoing-battle-cry` こだまする雄叫び
- `common-skill-weapon-enchantment` 武器エンチャント
- `common-skill-dont-rush-me` 急かさないで！
- `common-skill-double-rainbow` ダブルレインボー
- `common-skill-false-life` 偽りの命
- `common-skill-fortunas-kiss` フォルトゥナのキス
- `common-skill-unknown-skill` 未知のスキル
- `common-skill-hardwood` 堅木
- `common-skill-holy-for-a-price` 神の光も金次第
- `common-skill-bag-surprise` バッグり仰天
- `common-skill-dig-deeper` 深掘り
- `common-skill-knife-to-meet-you` ナイフ・トゥ・ミーチュー
- `common-skill-protection` 庇護
- `common-skill-stone-fortress` 石塁
- `common-skill-magic-mastery` 魔法熟達
- `common-skill-moon-power` 月の力
- `common-skill-heavy-drinking` ガブ飲み
- `common-skill-girl-power` ガールパワー
- `common-skill-blood-manipulation` 血操術
- `common-skill-bursting-brambles` 爆ぜる荊棘
- `common-stankus-toothpick` スタンクスの爪楊枝
- `common-skill-spicy-banana` スパイシーバナナ
- `common-skill-stinky-bulwark` 臭い立つ防壁
- `common-skill-piggy-pinata` ブタちゃんピニャータ
- `common-skill-investment-opportunity` 投資機会
- `common-skill-extra-capacity` 大容量
- `common-skill-smithing-for-dummies` サルでもわかる鍛冶
- `common-skill-uniquely-unique` ユニークなユニーク
- `common-impractically-large-greatsword` あまりにも大きすぎるグレートソード
- `common-pine-protector` パインの盾
- `common-bloody-dagger` 吸血のダガー
- `common-helm-of-discomfort` 苦痛のヘルム
- `common-shining-crown` 輝ける王冠
- `common-lightning-in-bottle` 瓶詰めの雷
- `common-rainbow-badge` レインボーバッジ
- `common-magic-badge` マジックバッジ
- `common-puzzle-badge` パズルバッジ
- `common-binding-thread-badge` 結び糸バッジ
- `common-cog-badge` 歯車バッジ
- `common-premium-subscription` サブスク高級プラン
- `common-serpent-staff` 毒蛇の杖
- `common-poison-spear` ポイズンスピア
- `common-holy-spear` ホーリースピア

残りの対象は `index.html` の `verified` フィールドから検索。

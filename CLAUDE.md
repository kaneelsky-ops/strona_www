# Instrukcje dla Claude

## Workflow zmian (obowiązkowy)

Strona jest wdrażana automatycznie przez Vercel z gałęzi `main` — każdy push na `main` od razu aktualizuje stronę na produkcji.

Przy **każdej** zmianie:

1. **Backup przed zmianą** — zanim cokolwiek trafi na `main`, utwórz gałąź-kopię aktualnego stanu `main`:
   ```bash
   git fetch origin main
   git push origin origin/main:refs/heads/backup/$(date -u +%Y-%m-%d-%H%M%S)
   ```
2. **Sprawdź zmiany lokalnie** — uruchom `npm test` i `npm run build`; jeśli coś nie przechodzi, nie wypychaj i zgłoś problem.
3. **Push bezpośrednio na `main`** — bez osobnych gałęzi roboczych i bez pull requestów:
   ```bash
   git push origin HEAD:main
   ```
4. Podaj użytkownikowi nazwę gałęzi backupu, żeby w razie problemu można było wrócić do poprzedniej wersji.

## Przywracanie backupu

Aby cofnąć stronę do stanu z backupu `backup/<data>`:
```bash
git fetch origin backup/<data>
git checkout main
git reset --hard origin/backup/<data>
git push --force-with-lease origin main
```
(Przed przywróceniem również zrób backup bieżącego `main`.)

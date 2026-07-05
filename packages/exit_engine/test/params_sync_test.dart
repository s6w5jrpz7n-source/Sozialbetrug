import 'dart:convert';
import 'dart:io';

import 'package:exit_engine/exit_engine.dart';
import 'package:test/test.dart';

void main() {
  group('params_2026.json', () {
    test('eingebettete Kopie ist identisch mit assets/params_2026.json', () {
      final fileContent = File('assets/params_2026.json').readAsStringSync();
      expect(params2026Json, fileContent,
          reason: 'lib/src/params_2026_data.dart ist veraltet - '
              'python3 tool/embed_params.py ausführen');
    });

    test('JSON ist gültig und vollständig parsebar', () {
      final params = ExitParams.year2026();
      expect(params.jahr, 2026);
    });

    test('Kernwerte 2026 (Spot-Checks gegen Rechtsquellen)', () {
      final p = ExitParams.year2026();
      // § 32a EStG 2026
      expect(p.tarif.grundfreibetragEuro, 12348);
      expect(p.tarif.zone2EndeEuro, 17799);
      expect(p.tarif.zone3EndeEuro, 69878);
      expect(p.tarif.zone4EndeEuro, 277825);
      // SV-Rechengrößen 2026
      expect(p.sozialversicherung.bbgKvPvJahrCents, 6975000);
      expect(p.sozialversicherung.bbgRvAvJahrCents, 10140000);
      // Soli 2026
      expect(p.soli.freigrenzeGrundtarifCents, 2035000);
      // Kirchensteuer: 8 % nur in BY und BW
      expect(p.kirchensteuer.satzFuer(Bundesland.bayern), 0.08);
      expect(p.kirchensteuer.satzFuer(Bundesland.badenWuerttemberg), 0.08);
      expect(p.kirchensteuer.satzFuer(Bundesland.nordrheinWestfalen), 0.09);
      // ALG-Anspruchsdauer: 7 Stufen, Maximum 720 Tage ab 58
      expect(p.alg1.anspruchsdauerTabelle, hasLength(7));
      expect(p.alg1.anspruchsdauerTabelle.last.anspruchTage, 720);
      expect(p.alg1.anspruchsdauerTabelle.last.mindestalter, 58);
    });

    test('alle 16 Bundesländer haben einen Kirchensteuersatz', () {
      final p = ExitParams.year2026();
      expect(p.kirchensteuer.saetzeJeBundesland.keys.toSet(), Bundesland.values.toSet());
    });

    test('keine null-Platzhalter (offene TODO-Werte) im Parametersatz', () {
      final decoded = (jsonDecode(params2026Json) as Map).cast<String, dynamic>();
      final nullPaths = <String>[];
      void walk(Object? node, String path) {
        if (node == null) {
          nullPaths.add(path);
        } else if (node is Map) {
          node.forEach((k, v) => walk(v, '$path.$k'));
        } else if (node is List) {
          for (var i = 0; i < node.length; i++) {
            walk(node[i], '$path[$i]');
          }
        }
      }

      walk(decoded, r'$');
      expect(nullPaths, isEmpty,
          reason: 'null-Werte sind offene TODOs und müssen in ASSUMPTIONS.md stehen');
    });
  });
}

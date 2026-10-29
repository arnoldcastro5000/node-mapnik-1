jest.mock('./Map', () => jest.fn());
const Map = require('./Map');
const { Config } = require('./config');

/*
 * The PGPool cache key is the sql only, and the sql does not depend on
 * the icon. So requests with different icons for the same sql must still
 * get the template of their own icon, from the cache and in flight.
 */
describe('getXMLString, different icons for the same sql', () => {
  let query;
  let config;

  beforeEach(() => {
    process.env.CACHE_SIZE = '100';
    process.env.CACHE_EXPIRE = '60000';
    Map.mockImplementation(() => ({
      init: jest.fn(),
      getQuery: jest.fn().mockResolvedValue('/* sql case1 */ fake_sql'),
    }));
    query = jest.fn(async () => {
      //slow enough to let the other request arrive while this one is in flight
      await new Promise((res) => setTimeout(() => res(), 100));
      return {
        rows: [
          {
            latlon: '{"type":"Point","coordinates":[-13.2,8.4]}',
            count: '10',
            count_text: '10',
            id: 1,
            type: 'cluster',
            zoom_to: null,
          },
        ],
      };
    });
    config = new Config({ query });
  });

  //ptk-s is ptk-b with the markers scaled to 0.81
  function expectIcon(xmlString, icon) {
    if (icon === 'ptk-s') {
      expect(xmlString).toMatch(/scale\(0\.81\)/);
      expect(xmlString).not.toMatch(/scale\(1\)/);
    } else {
      expect(xmlString).toMatch(/scale\(1\)/);
      expect(xmlString).not.toMatch(/scale\(0\.81\)/);
    }
    expect(xmlString).toMatch(/"id": 1/);
  }

  it('ptk-b, then ptk-s', async () => {
    expectIcon(
      await config.getXMLString({ zoomLevel: 2, icon: 'ptk-b' }),
      'ptk-b',
    );
    expectIcon(
      await config.getXMLString({ zoomLevel: 2, icon: 'ptk-s' }),
      'ptk-s',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('ptk-s, then ptk-b', async () => {
    expectIcon(
      await config.getXMLString({ zoomLevel: 2, icon: 'ptk-s' }),
      'ptk-s',
    );
    expectIcon(
      await config.getXMLString({ zoomLevel: 2, icon: 'ptk-b' }),
      'ptk-b',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('ptk-b and ptk-s in flight at the same time', async () => {
    const [xmlB, xmlS] = await Promise.all([
      config.getXMLString({ zoomLevel: 2, icon: 'ptk-b' }),
      config.getXMLString({ zoomLevel: 2, icon: 'ptk-s' }),
    ]);
    expectIcon(xmlB, 'ptk-b');
    expectIcon(xmlS, 'ptk-s');
    expect(query).toHaveBeenCalledTimes(1);
  });
});

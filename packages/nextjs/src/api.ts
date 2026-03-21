import { NextRequest, NextResponse } from 'next/server';
import { QatarAddress } from '@qatar-address/sdk';

const client = new QatarAddress({
  baseUrl: process.env.QATAR_ADDRESS_API_URL || 'https://api.qataraddress.com',
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zone = searchParams.get('zone');
  const street = searchParams.get('street');
  const building = searchParams.get('building');
  const action = searchParams.get('action') || 'validate';

  try {
    if (action === 'locate' && zone && street && building) {
      const result = await client.locate(parseInt(zone), parseInt(street), parseInt(building));
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'validate' && zone) {
      const result = await client.validate(
        parseInt(zone),
        street ? parseInt(street) : undefined,
        building ? parseInt(building) : undefined
      );
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'zones') {
      const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
      const result = await client.getZones(page);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters' } },
      { status: 422 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await client.contribute(body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'SERVER_ERROR', message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}
